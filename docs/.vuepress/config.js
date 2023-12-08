module.exports = {
    title: 'Pika',
    description: 'Pika是一个可持久化的大容量Redis存储服务，兼容string、hash、list、zset、set的绝大接口兼容详情，解决Redis由于存储数据量巨大而导致内存不够用的容量瓶颈。',
    base: "/vuepress-starter/",
    theme: 'reco',
    themeConfig: {
        home: '/document/Pika介绍',
        nav: [
            { text: "首页", link: "/" },
            { text: '文档',
                items: [
                    { text: "概况", link: "/document/Pika介绍" },
                    { text: "使用与运维", link: "/use/安装使用" },
                    { text: "设计与实现", link: "/design/整体架构" },
                ]
            },
            { text: "工具包", link: "/tool/3.2.新旧可读三类binlog转换工具" },
            { text: '周会纪要', link: '/weekly/20231201周会纪要' },
            { text: 'Github', link: 'https://github.com/OpenAtomFoundation/pika' },
        ],
        subSidebar: 'auto',
        sidebar: {
            '/weekly/': [
                {
                    title: "周会纪要",
                    path: "/weekly/20231201周会纪要",
                    collapsable: false,
                    children: [
                        { title: "20231201 周会纪要", path: "/weekly/20231201周会纪要"},
                        { title: "20231124 周会纪要", path: "/weekly/20231124周会纪要"},//自动获取README.md
                        { title: "20231117 周会纪要", path: "/weekly/20231117周会纪要"},
                        { title: "20231110 周会纪要", path: "/weekly/20231110周会纪要"}
                    ]
                }, 
                {
                    title: "Discussions",
                    path: "/weekly/discussions/数据迁移_QA",
                    collapsable: false,
                    children: [
                        { title: "数据迁移 QA", path: "/weekly/discussions/数据迁移_QA"},
                        { title: "floyd存储方案", path: "/weekly/discussions/floyd存储方案"},//自动获取README.md
                        { title: "Pika 编程规范", path: "/weekly/discussions/Pika编程规范"},
                        { title: "RSYNC 改造方案 - 少一", path: "/weekly/discussions/RSYNC改造方案"}
                    ]
                }
            ],
            '/document/': [{
                title: "概况",
                path: "/document/Pika介绍",
                collapsable: false,
                children: [
                    { title: "Pika介绍", path: "/document/Pika介绍"},//自动获取README.md
                    { title: "FAQ", path: "/document/FAQ"},
                    { title: "社区贡献文档", path: "/document/社区贡献文档"}
                ]
            }, {
                title: "发版文档",
                path: "/document/history/Pika_v3.5.2",
                collapsable: false,
                children: [
                    { title: "What's new in Pika v3.5.2", path: "/document/history/Pika_v3.5.2"},
                    { title: "What's new in Pika v3.5.1", path: "/document/history/Pika_v3.5.1"},
                    { title: "What's new in Pika v3.5.0", path: "/document/history/Pika_v3.5.0"}
                ]
            }, 
            {
                title: "性能",
                path: "/document/performance/3.2.x性能",
                collapsable: false,
                children: [
                    { title: "3.2.x性能", path: "/document/performance/3.2.x性能"},
                    
                ]
            },
            {
                title: "Develop",
                path: "/document/develop/Pikacodingstyle",
                collapsable: false,
                children: [
                    { title: "Pika coding style", path: "/document/develop/Pikacodingstyle"},
                    { title: "Pika 代码梳理", path: "/document/develop/pikacode"}
                ]
            }
            ],
            '/use/': [
                {
                    title: "使用与运维",
                    path: "/use/安装使用",
                    collapsable: true,
                    children: [
                        { title: "安装使用", path: "/use/安装使用"},
                        { title: "支持的语言和客户端", path: "/use/支持的语言和客户端"},
                        { title: "当前支持的Redis接口以及兼容情况", path: "/use/当前支持的Redis接口以及兼容情况"},
                        { title: "配置文件说明", path: "/use/配置文件说明"},
                        { title: "数据目录说明", path: "/use/数据目录说明"},
                        { title: "info信息说明", path: "/use/info信息说明"},
                        { title: "部分管理指令说明", path: "/use/部分管理指令说明"},
                        { title: "差异化命令", path: "/use/差异化命令"},
                        { title: "Pika Sharding Tutorials", path: "/use/Pika_Sharding_Tutorials"},
                        { title: "Pika订阅", path: "/use/Pika订阅"},
                        { title: "配合sentinel(哨兵)实现pika自动容灾", path: "/use/配合sentinel实现pika自动容灾"},
                        { title: "如何升级到Pika3.0", path: "/use/如何升级到Pika3.0"},
                        { title: "如何升级到Pika3.1或3.2", path: "/use/如何升级到Pika3.1"},
                        { title: "Pika多库版命令、参数变化参考", path: "/use/Pika多库版命令"},
                        { title: "Pika分片版本命令", path: "/use/Pika分片版本命令"},
                        { title: "副本一致性使用说明", path: "/use/副本一致性使用说明"},
                        { title: "Pika内存使用", path: "/use/Pika内存使用"},
                        { title: "Pika最佳实践", path: "/use/Pika最佳实践"},
                        { title: "调整 max-write-buffer-size 优化 pika 性能 10 倍的案例", path: "/use/调整max-write-buffer-size"},
                        { title: "Redis 与 Pika scan 性能对比", path: "/use/Redis与Pikascan性能对比"},
                        { title: "Pika 3.5 参数优化手册", path: "/use/Pika3.5参数优化手册"},
                        { title: "喜马拉雅 Redis 与 Pika 缓存使用军规", path: "/use/喜马拉雅Redis与Pika缓存使用军规"},
                        { title: "如何实现 3.3.6 升级到 3.5.x", path: "/use/如何实现3.3.6升级到3.5.x"},
                    ]
                }
            ],
            '/design/' : [
                {
                    title: "设计与实现",
                    path: "/design/整体架构",
                    collapsable: true,
                    children: [
                        { title: "整体架构", path: "/design/整体架构"},
                        { title: "线程模型", path: "/design/线程模型"},
                        { title: "全同步", path: "/design/全同步"},
                        { title: "增量同步", path: "/design/增量同步"},
                        { title: "副本一致性", path: "/design/副本一致性"},
                        { title: "快照式备份", path: "/design/快照式备份"},
                        { title: "锁的应用", path: "/design/锁的应用"},
                        { title: "nemo存储引擎数据格式", path: "/design/nemo存储引擎数据格式"},
                        { title: "blackwidow存储引擎数据格式", path: "/design/blackwidow存储引擎数据格式"},
                        { title: "Pika源码学习--pika的通信和线程模型", path: "/design/Pika源码学习study1"},
                        { title: "Pika源码学习--pika的PubSub机制", path: "/design/Pika源码学习study2"},
                        { title: "Pika源码学习--pika的命令执行框架", path: "/design/Pika源码学习study3"},
                        { title: "Pika源码学习--pika和rocksdb的对接", path: "/design/Pika源码学习study4"},
                        { title: "pika-NoSQL原理概述", path: "/design/pika-NoSQL原理概述"},
                        { title: "pika在codis中的探索", path: "/design/pika在codis中的探索"},
                        { title: "Pika 笔记", path: "/design/Pika笔记"},
                        { title: "pika 主从同步原理", path: "/design/pika主从同步原理"},
                        { title: "Pika 新存储结构 Floyd", path: "/design/Pika新存储结构Floyd"},
                        { title: "floyd 存储方案", path: "/design/floyd存储方案"}
                    ]
                }
            ],
            '/tool/': [
                {
                    title: "工具包",
                    path: "/tool/3.2.新旧可读三类binlog转换工具",
                    collapsable: false,
                    children: [
                        { title: "3.2.新，旧，可读三类binlog转换工具", path: "/tool/3.2.新旧可读三类binlog转换工具"},
                        { title: "根据时间戳恢复数据工具", path: "/tool/根据时间戳恢复数据工具"},
                        { title: "Redis到Pika迁移工具", path: "/tool/Redis到Pika迁移工具"},
                        { title: "Redis请求实时copy到Pika工具", path: "/tool/Redis请求实时copy到Pika工具"},
                        { title: "Pika到Pika、Redis迁移工具 Pika-Port(适用于 Pika v2.x&v3.0.x)", path: "/tool/Pikatool1"},
                        { title: "Pika到Pika、Redis迁移工具 Pika-Migrage(适用于 Pika v3.2及以上版本)", path: "/tool/Pikatool2"},
                        { title: "Pika的kv数据写入txt文本工具", path: "/tool/Pika的kv数据写入txt文本工具"},
                        { title: "kv数据txt文本迁移Pika工具", path: "/tool/kv数据txt文本迁移Pika工具"},
                        { title: "pika exporter监控工具", path: "/tool/pikaexporter监控工具"},
                        { title: "codis-redis实时同步pika工具", path: "/tool/codis-redis实时同步pika工具"},
                    ]
                },
            ]
        }
    }
}