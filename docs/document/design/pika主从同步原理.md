---
title: pika主从同步原理
# author: --
# date: '2023-12-02'
---
## pika主从同步

主要为了分析探索一下pika是如何实现主从同步的，pika的主从同步的原理与redis的同步方案还不相同，本文主要是为了分析其主从同步的相关流程（pika基于3.4版本）。

## pika主从同步原理

主从同步的原理，主要是通过在启动的时候启动了两部分的线程来进行的。

- auxiliary\_thread线程
- pika\_rm中的pika\_repl\_client线程池和pika\_repl\_server线程池

先逐个分析一下两个部分线程的工作的流程。

### auxiliary\_thread线程

在pika的pika\_server的Start函数中启动了auxiliary\_thread线程。

```c++
  ret = pika_auxiliary_thread_->StartThread();
  if (ret != pink::kSuccess) {
    tables_.clear();
    LOG(FATAL) << "Start Auxiliary Thread Error: " << ret << (ret == pink::kCreateThreadError ? ": create thread error " : ": other error");
  }
```

此时启动的线程就是位于pika\_auxiliary\_thread.cc中的线程函数。

```c++
void* PikaAuxiliaryThread::ThreadMain() {
  while (!should_stop()) {            //  是否停止线程
    if (g_pika_conf->classic_mode()) {    // 判断当前运行的模式是分布式模式还是经典模式
      if (g_pika_server->ShouldMetaSync()) {
        g_pika_rm->SendMetaSyncRequest();
      } else if (g_pika_server->MetaSyncDone()) {
        g_pika_rm->RunSyncSlavePartitionStateMachine();
      }
    } else {
      g_pika_rm->RunSyncSlavePartitionStateMachine();  // 分布式模式则直接启动状态机的同步
    }

    Status s = g_pika_rm->CheckSyncTimeout(slash::NowMicros());  // 检查超时的节点
    if (!s.ok()) {
      LOG(WARNING) << s.ToString();
    }

    // TODO(whoiami) timeout
    s = g_pika_server->TriggerSendBinlogSync();     // 触发binlog的主从同步
    if (!s.ok()) {
      LOG(WARNING) << s.ToString();
    }
    // send to peer
    int res = g_pika_server->SendToPeer();   // 将待发送的任务加入到工作线程队列中
    if (!res) {
      // sleep 100 ms
      mu_.Lock();
      cv_.TimedWait(100);
      mu_.Unlock();
    } else {
      //LOG_EVERY_N(INFO, 1000) << "Consume binlog number " << res;
    }
  }
  return NULL;
}
```

#### RunSyncSlavePartitionStateMachine-

该函数就是处理主从同步过程中的状态机，根据不同的状态去进行不同的操作。

```c++
Status PikaReplicaManager::RunSyncSlavePartitionStateMachine() {
  slash::RWLock l(&partitions_rw_, false);
  for (const auto& item : sync_slave_partitions_) {   // 获取所有的从节点同步信息
    PartitionInfo p_info = item.first;
    std::shared_ptr<SyncSlavePartition> s_partition = item.second;
    if (s_partition->State() == ReplState::kTryConnect) {   // 如果同步的信息是kTryConnect则发送TrySync的同步请求
      LOG(WARNING) << "Partition start, Table Name: "
          << p_info.table_name_ << " Partition Id: " << p_info.partition_id_;
      SendPartitionTrySyncRequest(p_info.table_name_, p_info.partition_id_);
    } else if (s_partition->State() == ReplState::kTryDBSync) {  // 如果是kTryDB的状态则发送DB同步的请求
      SendPartitionDBSyncRequest(p_info.table_name_, p_info.partition_id_);
    } else if (s_partition->State() == ReplState::kWaitReply) {  // 如果是wait状态则什么都不做
      continue;
    } else if (s_partition->State() == ReplState::kWaitDBSync) {  // 如果是waitdb状态则等待
      std::shared_ptr<Partition> partition =
          g_pika_server->GetTablePartitionById(
                  p_info.table_name_, p_info.partition_id_);
      if (partition) {
        partition->TryUpdateMasterOffset();   // 更新和主之间的offset
      } else {
        LOG(WARNING) << "Partition not found, Table Name: "
          << p_info.table_name_ << " Partition Id: " << p_info.partition_id_;
      }
    } else if (s_partition->State() == ReplState::kConnected
      || s_partition->State() == ReplState::kNoConnect
      || s_partition->State() == ReplState::kDBNoConnect) {  // 如果是已连接或者失联则什么都不处理
      continue;
    }
  }
  return Status::OK();
}
```

从状态机的运行来看，所有的步骤都是依赖于该函数通过状态来驱动进行不同的操作。

#### CheckSyncTimeout-检查连接的超时时间

```c++
Status PikaReplicaManager::CheckSyncTimeout(uint64_t now) {
  slash::RWLock l(&partitions_rw_, false);

  for (auto& iter : sync_master_partitions_) {
    std::shared_ptr<SyncMasterPartition> partition = iter.second;
    Status s = partition->CheckSyncTimeout(now);  // 获取所有的master的同步节点检查是否超时
    if (!s.ok()) {
      LOG(WARNING) << "CheckSyncTimeout Failed " << s.ToString();
    }
  }
  for (auto& iter : sync_slave_partitions_) {
    std::shared_ptr<SyncSlavePartition> partition = iter.second;
    Status s = partition->CheckSyncTimeout(now);  // 获取所有slave的同步节点信息检查是否超时
    if (!s.ok()) {
      LOG(WARNING) << "CheckSyncTimeout Failed " << s.ToString();
    }
  }
  return Status::OK();
}
```

主要是检查master和slave的同步连接信息是否超时。

```c++
Status SyncMasterPartition::CheckSyncTimeout(uint64_t now) {
  std::unordered_map<std::string, std::shared_ptr<SlaveNode>> slaves = GetAllSlaveNodes();

  std::vector<Node> to_del;
  for (auto& slave_iter : slaves) {
    std::shared_ptr<SlaveNode> slave_ptr = slave_iter.second;   // 获取所有slave的连接信息
    slash::MutexLock l(&slave_ptr->slave_mu);
    if (slave_ptr->LastRecvTime() + kRecvKeepAliveTimeout < now) {  // 如果最后的时间超时则删除该连接
      to_del.push_back(Node(slave_ptr->Ip(), slave_ptr->Port()));
    } else if (slave_ptr->LastSendTime() + kSendKeepAliveTimeout < now && slave_ptr->sent_offset == slave_ptr->acked_offset) {  // 如果最后的发送时间未超时 并且主从同步的偏移量发送的与回复的相同则发送binlogchips请求并且更新当前的最后发送时间
      std::vector<WriteTask> task;
      RmNode rm_node(slave_ptr->Ip(), slave_ptr->Port(), slave_ptr->TableName(), slave_ptr->PartitionId(), slave_ptr->SessionId());
      WriteTask empty_task(rm_node, BinlogChip(LogOffset(), ""), LogOffset());
      task.push_back(empty_task);
      Status s = g_pika_rm->SendSlaveBinlogChipsRequest(slave_ptr->Ip(), slave_ptr->Port(), task);    // 同步当前的主从同步的信息
      slave_ptr->SetLastSendTime(now);
      if (!s.ok()) {
        LOG(INFO)<< "Send ping failed: " << s.ToString();
        return Status::Corruption("Send ping failed: " + slave_ptr->Ip() + ":" + std::to_string(slave_ptr->Port()));
      }
    }
  }

  for (auto& node : to_del) {  // 将超时的连接信息都删除掉
    coordinator_.SyncPros().RemoveSlaveNode(node.Ip(), node.Port());
    g_pika_rm->DropItemInWriteQueue(node.Ip(), node.Port());
    LOG(WARNING) << SyncPartitionInfo().ToString() << " Master del Recv Timeout slave success " << node.ToString();
  }
  return Status::OK();
}
```

主节点主要维护了当前的一些主从连接的信息维护。

```c++
Status SyncSlavePartition::CheckSyncTimeout(uint64_t now) {
  slash::MutexLock l(&partition_mu_);
  // no need to do session keepalive return ok
  if (repl_state_ != ReplState::kWaitDBSync && repl_state_ != ReplState::kConnected) {
    return Status::OK();  // 如果从节点的信息不是waitdb或者连接状态则返回ok
  }
  if (m_info_.LastRecvTime() + kRecvKeepAliveTimeout < now) {
    // update slave state to kTryConnect, and try reconnect to master node
    repl_state_ = ReplState::kTryConnect;
    g_pika_server->SetLoopPartitionStateMachine(true);  // 否则就设置成tryconnect状态去尝试连接主节点
  }
  return Status::OK();
}
```

#### TriggerSendBinlogSync-生成每个节点待发送的数据任务

```c++
Status PikaServer::TriggerSendBinlogSync() {
  return g_pika_rm->WakeUpBinlogSync();
}

...

Status PikaReplicaManager::WakeUpBinlogSync() {
  slash::RWLock l(&partitions_rw_, false);
  for (auto& iter : sync_master_partitions_) {
    std::shared_ptr<SyncMasterPartition> partition = iter.second;
    Status s = partition->WakeUpSlaveBinlogSync(); // 检查每个节点是否需要生成binlog同步任务
    if (!s.ok()) {
      return s;
    }
  }
  return Status::OK();
}
```

主要是检查每个连接的从节点信息是否需要生成同步binlog任务。

```c++
Status SyncMasterPartition::WakeUpSlaveBinlogSync() {
  std::unordered_map<std::string, std::shared_ptr<SlaveNode>> slaves = GetAllSlaveNodes();
  std::vector<std::shared_ptr<SlaveNode>> to_del;
  for (auto& slave_iter : slaves) {
    std::shared_ptr<SlaveNode> slave_ptr = slave_iter.second;
    slash::MutexLock l(&slave_ptr->slave_mu);
    if (slave_ptr->sent_offset == slave_ptr->acked_offset) {  // 检查当前同步的数据信息是否跟回复的数据偏移相同
      Status s = ReadBinlogFileToWq(slave_ptr);  // 写binlog任务到该从节点连接上面
      if (!s.ok()) {
        to_del.push_back(slave_ptr);
        LOG(WARNING) << "WakeUpSlaveBinlogSync falied, Delete from RM, slave: " <<
          slave_ptr->ToStringStatus() << " " << s.ToString();
      }
    }
  }
  for (auto& to_del_slave : to_del) {  // 如果同步失败则删除该node
    RemoveSlaveNode(to_del_slave->Ip(), to_del_slave->Port());
  }
  return Status::OK();
}
```

其中ReadBinlogFileToWq就是根据当前的连接来生成binlog同步任务。

```c++
Status SyncMasterPartition::ReadBinlogFileToWq(const std::shared_ptr<SlaveNode>& slave_ptr) {
  int cnt = slave_ptr->sync_win.Remaining();
  std::shared_ptr<PikaBinlogReader> reader = slave_ptr->binlog_reader;  //获取当前binlogreader
  if (reader == nullptr) {
    return Status::OK();
  }
  std::vector<WriteTask> tasks;
  for (int i = 0; i < cnt; ++i) {
    std::string msg;
    uint32_t filenum;
    uint64_t offset;
    if (slave_ptr->sync_win.GetTotalBinlogSize() > PIKA_MAX_CONN_RBUF_HB * 2) {
      LOG(INFO) << slave_ptr->ToString() << " total binlog size in sync window is :"
                << slave_ptr->sync_win.GetTotalBinlogSize();
      break;  //检查当前同步窗口的大小
    }
    Status s = reader->Get(&msg, &filenum, &offset);  //获取对应的偏移数据
    if (s.IsEndFile()) {
      break;
    } else if (s.IsCorruption() || s.IsIOError()) {
      LOG(WARNING) << SyncPartitionInfo().ToString()
        << " Read Binlog error : " << s.ToString();
      return s;
    }
    BinlogItem item;
    if (!PikaBinlogTransverter::BinlogItemWithoutContentDecode(
          TypeFirst, msg, &item)) {
      LOG(WARNING) << "Binlog item decode failed";
      return Status::Corruption("Binlog item decode failed");
    }
    BinlogOffset sent_b_offset = BinlogOffset(filenum, offset);   // 生成发送的偏移量
    LogicOffset sent_l_offset = LogicOffset(item.term_id(), item.logic_id());
    LogOffset sent_offset(sent_b_offset, sent_l_offset);

    slave_ptr->sync_win.Push(SyncWinItem(sent_offset, msg.size()));  //设置同步窗口的大小
    slave_ptr->SetLastSendTime(slash::NowMicros());   //设置最后的发送时间
    RmNode rm_node(slave_ptr->Ip(), slave_ptr->Port(), slave_ptr->TableName(), slave_ptr->PartitionId(), slave_ptr->SessionId());
    WriteTask task(rm_node, BinlogChip(sent_offset, msg), slave_ptr->sent_offset);
    tasks.push_back(task);  // 包装成任务
    slave_ptr->sent_offset = sent_offset;  // 设置当前的发送偏移量
  }

  if (!tasks.empty()) {
    g_pika_rm->ProduceWriteQueue(slave_ptr->Ip(), slave_ptr->Port(), partition_info_.partition_id_, tasks);  // 将任务放入队列中等待处理
  }
  return Status::OK();
}
```

主要就是通过获取偏移量，然后生成任务并放入发送队列中等待处理。

#### SendToPeer-将待发送的binlog同步任务发送给从节点

```c++
int PikaServer::SendToPeer() {
  return g_pika_rm->ConsumeWriteQueue();
}

...
  
int PikaReplicaManager::ConsumeWriteQueue() {
  std::unordered_map<std::string, std::vector<std::vector<WriteTask>>> to_send_map;
  int counter = 0;
  {
    slash::MutexLock l(&write_queue_mu_);
    for (auto& iter : write_queues_) {
      const std::string& ip_port = iter.first;
      std::unordered_map<uint32_t, std::queue<WriteTask>>& p_map = iter.second; //获取队列
      for (auto& partition_queue : p_map) {
        std::queue<WriteTask>& queue = partition_queue.second;
        for (int i = 0; i < kBinlogSendPacketNum; ++i) {
          if (queue.empty()) {
            break;
          }
          size_t batch_index = queue.size() > kBinlogSendBatchNum ? kBinlogSendBatchNum : queue.size();   // 检查当前可发送的大小
          std::vector<WriteTask> to_send;
          int batch_size = 0;
          for (size_t i = 0; i < batch_index; ++i) {
            WriteTask& task = queue.front();
            batch_size +=  task.binlog_chip_.binlog_.size();
            // make sure SerializeToString will not over 2G
            if (batch_size > PIKA_MAX_CONN_RBUF_HB) {
              break;
            }
            to_send.push_back(task);  // 放入可发送的队列中
            queue.pop();
            counter++;
          }
          if (!to_send.empty()) {
            to_send_map[ip_port].push_back(std::move(to_send));
          }
        }
      }
    }
  }

  std::vector<std::string> to_delete;
  for (auto& iter : to_send_map) {
    std::string ip;
    int port = 0;
    if (!slash::ParseIpPortString(iter.first, ip, port)) {
      LOG(WARNING) << "Parse ip_port error " << iter.first;
      continue;
    }
    for (auto& to_send : iter.second) {
      Status s = pika_repl_server_->SendSlaveBinlogChips(ip, port, to_send); // 发送Binglog任务
      if (!s.ok()) {
        LOG(WARNING) << "send binlog to " << ip << ":" << port << " failed, " << s.ToString();
        to_delete.push_back(iter.first);  // 如果发送失败则放入失败队列中
        continue;
      }
    }
  }

  if (!to_delete.empty()) {
    {
      slash::MutexLock l(&write_queue_mu_);
      for (auto& del_queue : to_delete) {
        write_queues_.erase(del_queue);  //删除发送失败的任务
      }
    }
  }
  return counter;
}
```

最终通过pika\_repl\_server\_的SendSlaveBinlogChip[s函数](https://so.csdn.net/so/search?q=s%E5%87%BD%E6%95%B0&spm=1001.2101.3001.7020)将当前待发送的任务发送出去。

### pika\_repl\_client和pika\_repl\_server\_线程

这两个线程就是维护了主从连接的client和server端的交互功能，auxiliary\_thread中状态机触发的连接状态就是依赖于这两个线程来完成交互。

#### pika\_repl\_client客户端连接管理线程

pika\_reple\_client的最核心的原理就是通过一个基于epoll（linux平台）的事件驱动，去完成多个连接的事件驱动，并通过加入线程池来提供epoll的处理性能。接下来就大致了解一下pika\_repl\_client完成的交互的相关功能。

在主从同步过程中，无论是pika\_repl\_client还是pika\_repl\_server\_底层都利用了pink库的PbConn模式来进行的数据交互。

通过client\_thread的逻辑流程来简单分析一下PbConn的执行流程。

在PikaReplClient的Start流程中，启动了如下线程。

```c++
int PikaReplClient::Start() {
  int res = client_thread_->StartThread();   // 启动一个epoll的事件驱动
  if (res != pink::kSuccess) {
    LOG(FATAL) << "Start ReplClient ClientThread Error: " << res << (res == pink::kCreateThreadError ? ": create thread error " : ": other error");
  }
  for (size_t i = 0; i < bg_workers_.size(); ++i) {  // 通过将epoll事件驱动的执行分发到线程池中执行
    res = bg_workers_[i]->StartThread();
    if (res != pink::kSuccess) {
      LOG(FATAL) << "Start Pika Repl Worker Thread Error: " << res
        << (res == pink::kCreateThreadError ? ": create thread error " : ": other error");
    }
  }
  return res;
}
```

此时client\_thread启动的就是位于pink的client\_thread.c中的ClientThread线程。

```c++
void *ClientThread::ThreadMain() {
  int nfds = 0;
  PinkFiredEvent *pfe = NULL;

  struct timeval when;
  gettimeofday(&when, NULL);
  struct timeval now = when;

  when.tv_sec += (cron_interval_ / 1000);
  when.tv_usec += ((cron_interval_ % 1000) * 1000);
  int timeout = cron_interval_;
  if (timeout <= 0) {
    timeout = PINK_CRON_INTERVAL;
  }

  std::string ip_port;

  while (!should_stop()) {
    if (cron_interval_ > 0) {
      gettimeofday(&now, nullptr);
      if (when.tv_sec > now.tv_sec ||
          (when.tv_sec == now.tv_sec && when.tv_usec > now.tv_usec)) {
        timeout = (when.tv_sec - now.tv_sec) * 1000 +
          (when.tv_usec - now.tv_usec) / 1000;
      } else {
        // do user defined cron
        handle_->CronHandle();   // 执行定时任务

        DoCronTask();
        when.tv_sec = now.tv_sec + (cron_interval_ / 1000);
        when.tv_usec = now.tv_usec + ((cron_interval_ % 1000) * 1000);
        timeout = cron_interval_;
      }
    }
    //{
    //InternalDebugPrint();
    //}
    nfds = pink_epoll_->PinkPoll(timeout);  //事件驱动
    for (int i = 0; i < nfds; i++) {
      pfe = (pink_epoll_->firedevent()) + i;
      if (pfe == NULL) {
        continue;
      }

      if (pfe->fd == pink_epoll_->notify_receive_fd()) {  // 处理驱动
        ProcessNotifyEvents(pfe);
        continue;
      }

      int should_close = 0;
      std::map<int, std::shared_ptr<PinkConn>>::iterator iter = fd_conns_.find(pfe->fd);
      if (iter == fd_conns_.end()) {
        log_info("fd %d not found in fd_conns\n", pfe->fd);
        pink_epoll_->PinkDelEvent(pfe->fd);
        continue;
      }

      std::shared_ptr<PinkConn> conn = iter->second;

      if (connecting_fds_.count(pfe->fd)) {
        Status s = ProcessConnectStatus(pfe, &should_close);
        if (!s.ok()) {
          handle_->DestConnectFailedHandle(conn->ip_port(), s.ToString());
        }
        connecting_fds_.erase(pfe->fd);
      }

      if (!should_close && (pfe->mask & EPOLLOUT) && conn->is_reply()) {
        WriteStatus write_status = conn->SendReply();   // 如果当前是可以写数据则调用SendReply
        conn->set_last_interaction(now);
        if (write_status == kWriteAll) {
          pink_epoll_->PinkModEvent(pfe->fd, 0, EPOLLIN);
          conn->set_is_reply(false);
        } else if (write_status == kWriteHalf) {
          continue;
        } else {
          log_info("send reply error %d\n", write_status);
          should_close = 1;
        }
      }

      if (!should_close && (pfe->mask & EPOLLIN)) {
        ReadStatus read_status = conn->GetRequest();  // 如果是接受数据则调用GetRequest来解析
        conn->set_last_interaction(now);
        if (read_status == kReadAll) {
          // pink_epoll_->PinkModEvent(pfe->fd, 0, EPOLLOUT);
        } else if (read_status == kReadHalf) {
          continue;
        } else {
          log_info("Get request error %d\n", read_status);
          should_close = 1;
        }
      }

      if ((pfe->mask & EPOLLERR) || (pfe->mask & EPOLLHUP) || should_close) {
        {
          log_info("close connection %d reason %d %d\n", pfe->fd, pfe->mask, should_close);
          pink_epoll_->PinkDelEvent(pfe->fd);  // 如果关闭则删除该事件
          CloseFd(conn);
          fd_conns_.erase(pfe->fd);
          if (ipport_conns_.count(conn->ip_port())) {
            ipport_conns_.erase(conn->ip_port());
          }
          if (connecting_fds_.count(conn->fd())) {
            connecting_fds_.erase(conn->fd());
          }
        }
      }
    }
  }
  return nullptr;
}
```

通过client\_thread的执行函数可知，这是一个标准的事件驱动模型。如果可写入则调用conn的SendReply函数，如果是接受事情则调用conn的GetRequest函数。此时的conn就是PbConn。

```c++
// Msg is [ length(COMMAND_HEADER_LENGTH) | body(length bytes) ]
//   step 1. kHeader, we read COMMAND_HEADER_LENGTH bytes;
//   step 2. kPacket, we read header_len bytes;
ReadStatus PbConn::GetRequest() {
  while (true) {
    switch (connStatus_) {
      case kHeader: {
        ssize_t nread = read(
            fd(), rbuf_ + cur_pos_, COMMAND_HEADER_LENGTH - cur_pos_); // 解析头部信息
        if (nread == -1) {
          if (errno == EAGAIN) {
            return kReadHalf;
          } else {
            return kReadError;
          }
        } else if (nread == 0) {
          return kReadClose;
        } else {
          cur_pos_ += nread;
          if (cur_pos_ == COMMAND_HEADER_LENGTH) {
            uint32_t integer = 0;
            memcpy(reinterpret_cast<char*>(&integer),
                   rbuf_, sizeof(uint32_t));
            header_len_ = ntohl(integer);
            remain_packet_len_ = header_len_;
            connStatus_ = kPacket;
            continue;
          }
          return kReadHalf;
        }
      }
      case kPacket: {
        if (header_len_ > rbuf_len_ - COMMAND_HEADER_LENGTH) {  //解析packet
          uint32_t new_size = header_len_ + COMMAND_HEADER_LENGTH;
          if (new_size < kProtoMaxMessage) {
            rbuf_ = reinterpret_cast<char *>(realloc(rbuf_, sizeof(char) * new_size));
            if (rbuf_ == NULL) {
              return kFullError;
            }
            rbuf_len_ = new_size;
            log_info("Thread_id %ld Expand rbuf to %u, cur_pos_ %u\n", pthread_self(), new_size, cur_pos_);
          } else {
            return kFullError;
          }
        }
        // read msg body
        ssize_t nread = read(fd(), rbuf_ + cur_pos_, remain_packet_len_);
        if (nread == -1) {
          if (errno == EAGAIN) {
            return kReadHalf;
          } else {
            return kReadError;
          }
        } else if (nread == 0) {
          return kReadClose;
        }
        cur_pos_ += nread;
        remain_packet_len_ -= nread;
        if (remain_packet_len_ == 0) {
          connStatus_ = kComplete;
          continue;
        }
        return kReadHalf;
      }
      case kComplete: {  //解析完成之后调用DealMessage函数来处理
        if (DealMessage() != 0) {
          return kDealError;
        }
        connStatus_ = kHeader;
        cur_pos_ = 0;
        return kReadAll;
      }
      // Add this switch case just for delete compile warning
      case kBuildObuf:
        break;

      case kWriteObuf:
        break;
    }
  }

  return kReadHalf;
}

WriteStatus PbConn::SendReply() {
  ssize_t nwritten = 0;
  size_t item_len;
  slash::MutexLock l(&resp_mu_);
  while (!write_buf_.queue_.empty()) {  //写入的队列是否为空
    std::string item = write_buf_.queue_.front();
    item_len = item.size();
    while (item_len - write_buf_.item_pos_ > 0) {
      nwritten = write(fd(), item.data() + write_buf_.item_pos_, item_len - write_buf_.item_pos_);   // 将数据写入对应的文件描述符
      if (nwritten <= 0) {
        break;
      }
      write_buf_.item_pos_ += nwritten;
      if (write_buf_.item_pos_ == item_len) {
        write_buf_.queue_.pop();
        write_buf_.item_pos_ = 0;
        item_len = 0;
      }
    }
    if (nwritten == -1) {
      if (errno == EAGAIN) {
        return kWriteHalf;
      } else {
        // Here we should close the connection
        return kWriteError;
      }
    }
    if (item_len - write_buf_.item_pos_ != 0) {
      return kWriteHalf;
    }
  }
  return kWriteAll;
}
```

从client的事件驱动可知，处理的主要的逻辑函数就是自定义的DealMessage()函数。

我们继续分析PikaReplClientConn类。

在pika\_repl\_client\_thread.h的定义中。

```c++
class PikaReplClientThread : public pink::ClientThread {
 public:
  PikaReplClientThread(int cron_interval, int keepalive_timeout);
  virtual ~PikaReplClientThread() = default;
  int Start();

 private:
  class ReplClientConnFactory : public pink::ConnFactory {
   public:
    virtual std::shared_ptr<pink::PinkConn> NewPinkConn(
        int connfd,
        const std::string &ip_port,
        pink::Thread *thread,
        void* worker_specific_data,
        pink::PinkEpoll* pink_epoll) const override {
      return std::static_pointer_cast<pink::PinkConn>
        (std::make_shared<PikaReplClientConn>(connfd, ip_port, thread, worker_specific_data, pink_epoll));  // 新连接进来的时候通过初始化成PikaReplClientConn
    }
  };
  class ReplClientHandle : public pink::ClientHandle {
   public:
    void CronHandle() const override {
    }
    void FdTimeoutHandle(int fd, const std::string& ip_port) const override;
    void FdClosedHandle(int fd, const std::string& ip_port) const override;
    bool AccessHandle(std::string& ip) const override {
      // ban 127.0.0.1 if you want to test this routine
      // if (ip.find("127.0.0.2") != std::string::npos) {
      //   std::cout << "AccessHandle " << ip << std::endl;
      //   return false;
      // }
      return true;
    }
    int CreateWorkerSpecificData(void** data) const override {
      return 0;
    }
    int DeleteWorkerSpecificData(void* data) const override {
      return 0;
    }
    void DestConnectFailedHandle(std::string ip_port, std::string reason) const override {
    }
  };

  ReplClientConnFactory conn_factory_;
  ReplClientHandle handle_;
};
```

由于每次client\_thread都会将新连接通过PikaReplClientConn来初始化，故每次有事件驱动的时候就调用该PikaReplClientConn的Dealmessage函数，来处理解析的数据。

```c++
int PikaReplClientConn::DealMessage() {
  std::shared_ptr<InnerMessage::InnerResponse> response =  std::make_shared<InnerMessage::InnerResponse>();
  ::google::protobuf::io::ArrayInputStream input(rbuf_ + cur_pos_ - header_len_, header_len_);
  ::google::protobuf::io::CodedInputStream decoder(&input);
  decoder.SetTotalBytesLimit(g_pika_conf->max_conn_rbuf_size(), g_pika_conf->max_conn_rbuf_size());
  bool success = response->ParseFromCodedStream(&decoder) && decoder.ConsumedEntireMessage();  
  if (!success) {
    LOG(WARNING) << "ParseFromArray FAILED! " << " msg_len: " << header_len_;
    g_pika_server->SyncError();
    return -1;
  }
  switch (response->type()) {  // 根据协议解析的类型来判断执行什么操作
    case InnerMessage::kMetaSync:
    {
      ReplClientTaskArg* task_arg = new ReplClientTaskArg(response, std::dynamic_pointer_cast<PikaReplClientConn>(shared_from_this()));
      g_pika_rm->ScheduleReplClientBGTask(&PikaReplClientConn::HandleMetaSyncResponse, static_cast<void*>(task_arg));  // 如果是元数据同步，将该事件放入到处理线程池中执行
      break;
    }
    case InnerMessage::kDBSync:
    {
      ReplClientTaskArg* task_arg = new ReplClientTaskArg(response, std::dynamic_pointer_cast<PikaReplClientConn>(shared_from_this()));
      g_pika_rm->ScheduleReplClientBGTask(&PikaReplClientConn::HandleDBSyncResponse, static_cast<void*>(task_arg));
      break;
    }
    case InnerMessage::kTrySync:
    {
      ReplClientTaskArg* task_arg = new ReplClientTaskArg(response, std::dynamic_pointer_cast<PikaReplClientConn>(shared_from_this()));
      g_pika_rm->ScheduleReplClientBGTask(&PikaReplClientConn::HandleTrySyncResponse, static_cast<void*>(task_arg));  // 如果是同步则放入线程池中去执行HandleTrySyncResponse函数
      break;
    }
    case InnerMessage::kBinlogSync:
    {
      DispatchBinlogRes(response);  // binlog同步处理
      break;
    }
    case InnerMessage::kRemoveSlaveNode:
    {
      ReplClientTaskArg* task_arg = new ReplClientTaskArg(response, std::dynamic_pointer_cast<PikaReplClientConn>(shared_from_this()));
      g_pika_rm->ScheduleReplClientBGTask(&PikaReplClientConn::HandleRemoveSlaveNodeResponse, static_cast<void*>(task_arg));
      break;
    }
    default:
      break;
  }
  return 0;
}
```

至此，一个pika\_repl\_client的整个的处理流程就清晰，即每次都会根据协议调用PikaReplClientConn的DealMessage函数，将每个执行任务放入线程池中去处理。

#### pika\_repl\_server线程

该线程的核心思想与pika\_repl\_client的处理流程差不多，只不过在pink中对应的是HolyThread，处理流程大同小异，最终调用的就是PikaReplServerConn的DealMessage方法。

```c++
int PikaReplServerConn::DealMessage() {
  std::shared_ptr<InnerMessage::InnerRequest> req = std::make_shared<InnerMessage::InnerRequest>();
  bool parse_res = req->ParseFromArray(rbuf_ + cur_pos_ - header_len_, header_len_);
  if (!parse_res) {
    LOG(WARNING) << "Pika repl server connection pb parse error.";
    return -1;
  }
  switch (req->type()) {
    case InnerMessage::kMetaSync:
    {
      ReplServerTaskArg* task_arg = new ReplServerTaskArg(req, std::dynamic_pointer_cast<PikaReplServerConn>(shared_from_this()));
      g_pika_rm->ScheduleReplServerBGTask(&PikaReplServerConn::HandleMetaSyncRequest, task_arg);
      break;
    }
    case InnerMessage::kTrySync:
    {
      ReplServerTaskArg* task_arg = new ReplServerTaskArg(req, std::dynamic_pointer_cast<PikaReplServerConn>(shared_from_this()));
      g_pika_rm->ScheduleReplServerBGTask(&PikaReplServerConn::HandleTrySyncRequest, task_arg);
      break;
    }
    case InnerMessage::kDBSync:
    {
      ReplServerTaskArg* task_arg = new ReplServerTaskArg(req, std::dynamic_pointer_cast<PikaReplServerConn>(shared_from_this()));
      g_pika_rm->ScheduleReplServerBGTask(&PikaReplServerConn::HandleDBSyncRequest, task_arg);
      break;
    }
    case InnerMessage::kBinlogSync:
    {
      ReplServerTaskArg* task_arg = new ReplServerTaskArg(req, std::dynamic_pointer_cast<PikaReplServerConn>(shared_from_this()));
      g_pika_rm->ScheduleReplServerBGTask(&PikaReplServerConn::HandleBinlogSyncRequest, task_arg);
      break;
    }
    case InnerMessage::kRemoveSlaveNode:
    {
      ReplServerTaskArg* task_arg = new ReplServerTaskArg(req, std::dynamic_pointer_cast<PikaReplServerConn>(shared_from_this()));
      g_pika_rm->ScheduleReplServerBGTask(&PikaReplServerConn::HandleRemoveSlaveNodeRequest, task_arg);
      break;
    }
    default:
      break;
  }
  return 0;
}

```

### 主从同步的流程

pika\_repl\_server的流程可用如图描述。

![在这里插入图片描述](https://img-blog.csdnimg.cn/f5f65e0cb6e74b45a9afbc45933ab12f.png?x-oss-process=image/watermark,type_d3F5LXplbmhlaQ,shadow_50,text_Q1NETiBA5bCP5bGL5a2Q5aSn5L6g,size_20,color_FFFFFF,t_70,g_se,x_16#pic_center)

pika\_repl\_client的流程可用如图描述。

![在这里插入图片描述](https://img-blog.csdnimg.cn/8cd2006d23814034b0b6372412506363.png?x-oss-process=image/watermark,type_d3F5LXplbmhlaQ,shadow_50,text_Q1NETiBA5bCP5bGL5a2Q5aSn5L6g,size_20,color_FFFFFF,t_70,g_se,x_16#pic_center)

主从的状态机流程如下。

![在这里插入图片描述](https://img-blog.csdnimg.cn/9fbd751015384d198c2ea514e4ca84b6.png?x-oss-process=image/watermark,type_d3F5LXplbmhlaQ,shadow_50,text_Q1NETiBA5bCP5bGL5a2Q5aSn5L6g,size_12,color_FFFFFF,t_70,g_se,x_16#pic_center)

通过如上三个图就可以能够明白pika官网描述的主从同步的流程图。

[pika-增量同步](https://github.com/OpenAtomFoundation/pika/wiki/pika-%E5%A2%9E%E9%87%8F%E5%90%8C%E6%AD%A5)

[pika-全同步](https://github.com/OpenAtomFoundation/pika/wiki/pika-%E5%85%A8%E5%90%8C%E6%AD%A5)

## 总结

本文根据pika官网的流程，分析了一下pika主从的一个大致流程，其中还包含了很多的技术细节限于本文篇幅并没有详尽分析，主要通过原理流程的一个分析来查看了主从同步的状态机线程，和主从同步的线程模型的基本原理。由于本人才疏学浅，如有错误请批评指正。