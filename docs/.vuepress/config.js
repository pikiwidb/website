module.exports = {
  title: "Pika",
  description:
    "Pika是一个可持久化的大容量Redis存储服务，兼容string、hash、list、zset、set的绝大接口兼容详情，解决Redis由于存储数据量巨大而导致内存不够用的容量瓶颈。",
  base: "/",
  theme: "vuepress-theme-reco",
  themeConfig: {
    docsDir: "/docs",
    logo: "/pika-smalllogo.png",
    search: false,
    // 导航栏
    nav: [
      { text: "首页", link: "/" },
      {
        text: "文档",
        link: "/document/Pika介绍",
        // items: [
        //   { text: "Pika介绍", link: "/document/Pika介绍" },
        //   { text: "设计与实现", link: "/document/design/整体架构" },
        // ],
      },
      { text: "工具包", link: "/tool/3.2.新旧可读三类binlog转换工具" },
      { text: "GitHub", link: "https://github.com/OpenAtomFoundation/pika" },
    ],

    subSidebar: "auto",
    sidebar: {
      "/document/": [
        {
          title: "概况",
          path: "/document/Pika介绍",
          collapsable: false,
          children: [
            { title: "Pika介绍", path: "/document/Pika介绍" }, //自动获取README.md
            {
              title: "支持的语言和客户端",
              path: "/document/use/支持的语言和客户端",
            },
            {
              title: "支持的Redis接口",
              path: "/document/use/当前支持的Redis接口以及兼容情况",
            },
            { title: "FAQ", path: "/document/FAQ" },
          ],
        },
        {
          title: "使用与运维",
        //   path: "/document/use/安装使用",
          collapsable: true,
          children: [
            { title: "安装使用", path: "/document/use/安装使用" },
            { title: "配置文件", path: "/document/use/配置文件说明" },
            { title: "数据目录", path: "/document/use/数据目录说明" },
            { title: "info信息", path: "/document/use/info信息说明" },
            {
              title: "管理指令",
              path: "/document/use/部分管理指令说明",
            },
            { title: "差异化命令", path: "/document/use/差异化命令" },
            { title: "Pika订阅", path: "/document/use/Pika订阅" },
            {
              title: "自动容灾",
              path: "/document/use/配合sentinel实现pika自动容灾",
            },
            {
              title: "多库版命令",
              path: "/document/use/Pika多库版命令",
            },
            {
              title: "Pika 分片",
              path: "/document/use/Pika_Sharding_Tutorials",
            },
            {
              title: "Pika分片版本命令",
              path: "/document/use/Pika分片版本命令",
            },
            {
              title: "副本一致性使用说明",
              path: "/document/use/副本一致性使用说明",
            },
            { title: "Pika最佳实践", path: "/document/use/Pika最佳实践" },
            {
              title: "Pika升级指南",
            //   path: "/document/use/如何实现3.3.6升级到3.5.x",
              collapsable: true,
              children: [
                {
                  title: "如何实现 3.3.6 升级到 3.5.x",
                  path: "/document/use/如何实现3.3.6升级到3.5.x",
                },
                {
                  title: "如何升级到Pika3.1或3.2",
                  path: "/document/use/如何升级到Pika3.1",
                },
                {
                  title: "如何升级到Pika3.0",
                  path: "/document/use/如何升级到Pika3.0",
                },
              ],
            },
          ],
        },
        {
          title: "性能与优化",
        //   path: "/document/performance/3.2.x性能",
          collapsable: true,
          children: [
            { title: "3.2.x性能", path: "/document/performance/3.2.x性能" },
            {
              title: "喜马拉雅 Redis 与 Pika 缓存使用军规",
              path: "/document/performance/喜马拉雅Redis与Pika缓存使用军规",
            },
            {
              title: "Redis 与 Pika scan 性能对比",
              path: "/document/performance/Redis与Pikascan性能对比",
            },
            {
              title: "调整 max-write-buffer-size",
              path: "/document/performance/调整max-write-buffer-size",
            },
            {
              title: "Pika 3.5 参数优化手册",
              path: "/document/performance/Pika3.5参数优化手册",
            },
            { title: "Pika内存使用", path: "/document/use/Pika内存使用" },
          ],
        },
        {
            title: "设计与实现",
            path: "/document/design/整体架构",
            collapsable: true,
            children: [
              { title: "整体架构", path: "/document/design/整体架构" },
              { title: "线程模型", path: "/document/design/线程模型" },
              { title: "全同步", path: "/document/design/全同步" },
              { title: "增量同步", path: "/document/design/增量同步" },
              { title: "副本一致性", path: "/document/design/副本一致性" },
              { title: "快照式备份", path: "/document/design/快照式备份" },
              { title: "锁的应用", path: "/document/design/锁的应用" },
              {
                title: "nemo存储引擎数据格式",
                path: "/document/design/nemo存储引擎数据格式",
              },
              {
                title: "blackwidow存储引擎数据格式",
                path: "/document/design/blackwidow存储引擎数据格式",
              },
              {
                title: "Pika的通信和线程模型",
                path: "/document/design/Pika源码学习study1",
              },
              {
                title: "Pika的PubSub机制",
                path: "/document/design/Pika源码学习study2",
              },
              {
                title: "Pika的命令执行框架",
                path: "/document/design/Pika源码学习study3",
              },
              {
                title: "Pika和rocksdb的对接",
                path: "/document/design/Pika源码学习study4",
              },
              { title: "Pika-NoSQL原理概述", path: "/document/design/pika-NoSQL原理概述" },
              {
                title: "Pika在codis中的探索",
                path: "/document/design/pika在codis中的探索",
              },
              { title: "Pika 笔记", path: "/document/design/Pika笔记" },
              { title: "Pika 主从同步原理", path: "/document/design/pika主从同步原理" },
              {
                title: "Pika 新存储结构 Floyd",
                path: "/document/design/Pika新存储结构Floyd",
              },
              { title: "floyd 存储方案", path: "/document/design/floyd存储方案" },
            ],
          },
        {
          title: "开发文档",
          path: "/document/develop/Pikacodingstyle",
          collapsable: false,
          children: [
            {
              title: "Pika 开发规范",
              path: "/document/develop/Pikacodingstyle",
            },
            { title: "Pika 代码梳理", path: "/document/develop/pikacode" },
          ],
        },
        {
          title: "项目历史",
        //   path: "/document/history/Pika_v3.5.2",
          collapsable: true,
          children: [
            {
              title: "版本日志",
            //   path: "/document/history/Pika_v3.5.2",
              collapsable: true,
              children: [
                {
                  title: "What's new in Pika v3.5.2",
                  path: "/document/history/Pika_v3.5.2",
                },
                {
                  title: "What's new in Pika v3.5.1",
                  path: "/document/history/Pika_v3.5.1",
                },
                {
                  title: "What's new in Pika v3.5.0",
                  path: "/document/history/Pika_v3.5.0",
                },
              ],
            },
            {
              title: "周会纪要",
            //   path: "/document/weekly/20231201周会纪要",
              collapsable: true,
              children: [
                {
                  title: "20231201 周会纪要",
                  path: "/document/weekly/20231201周会纪要",
                },
                {
                  title: "20231124 周会纪要",
                  path: "/document/weekly/20231124周会纪要",
                },
                {
                  title: "20231117 周会纪要",
                  path: "/document/weekly/20231117周会纪要",
                },
                {
                  title: "20231110 周会纪要",
                  path: "/document/weekly/20231110周会纪要",
                },
              ],
            },
          ],
        },
        { title: "社区贡献文档", path: "/document/社区贡献文档" },
      ],
      "/tool/": [
        {
          title: "工具包",
          path: "/tool/3.2.新旧可读三类binlog转换工具",
          collapsable: false,
          children: [
            {
              title: "3.2.新，旧，可读三类binlog转换工具",
              path: "/tool/3.2.新旧可读三类binlog转换工具",
            },
            {
              title: "根据时间戳恢复数据工具",
              path: "/tool/根据时间戳恢复数据工具",
            },
            { title: "Redis到Pika迁移工具", path: "/tool/Redis到Pika迁移工具" },
            {
              title: "Redis请求实时copy到Pika工具",
              path: "/tool/Redis请求实时copy到Pika工具",
            },
            {
              title:
                "Pika到Pika、Redis迁移工具 Pika-Port(适用于 Pika v2.x&v3.0.x)",
              path: "/tool/Pikatool1",
            },
            {
              title:
                "Pika到Pika、Redis迁移工具 Pika-Migrage(适用于 Pika v3.2及以上版本)",
              path: "/tool/Pikatool2",
            },
            {
              title: "Pika的kv数据写入txt文本工具",
              path: "/tool/Pika的kv数据写入txt文本工具",
            },
            {
              title: "kv数据txt文本迁移Pika工具",
              path: "/tool/kv数据txt文本迁移Pika工具",
            },
            {
              title: "pika exporter监控工具",
              path: "/tool/pikaexporter监控工具",
            },
            {
              title: "codis-redis实时同步pika工具",
              path: "/tool/codis-redis实时同步pika工具",
            },
          ],
        },
      ],
    },
  },
  plugins: [
    [
      "@vuepress-reco/vuepress-plugin-bulletin-popover",
      {
        width: "300px", // 默认 260px
        title: "公告",
        body: [
          {
            type: "title",
            content: "Pika最新版本3.5.4已经发布 🎉",
            style: "text-aligin: center;",
          },
          {
            type: "text",
            content: "对Pika感兴趣或有问题欢迎加群交流😀",
          },
          {
            type: "image",
            src: "/pika-wechat.png",
          },
          {
            type: "text",
            content: "还可以关注公众号获取最新动态🤩",
          },
          {
            type: "image",
            src: "/pika-sub.png",
          },
        ],
        //   footer: [
        //     {
        //       type: 'button',
        //       text: '打赏',
        //       link: '/donate'
        //     },
        //     {
        //       type: 'button',
        //       text: '打赏',
        //       link: '/donate'
        //     }
        //   ]
      },
    ],
  ],
};
