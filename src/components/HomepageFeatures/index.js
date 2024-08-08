import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: '迁移友好',
    description: (
      <>
        采取 Redis 协议的软件可以平滑过渡到 Pika
      </>
    ),
  },
  {
    title: 'Redis 兼容',
    description: (
      <>
        支持 Redis 中常用的数据结构
      </>
    ),
  },
  {
    title: '冷热数据',
    description: (
      <>
        支持冷热分级存储及热数据缓存机制
      </>
    ),
  },
  {
    title: '高容量存储',
    description: (
      <>
        可支持数百 GB 数据持久化存储
      </>
    ),
  },
  {
    title: '分布式部署',
    description: (
      <>
        容量调整便利，支持多种模式集群部署
      </>
    ),
  },
  {
    title: '管理自治',
    description: (
      <>
        运维指令与文档非常完备
      </>
    ),
  },
];

function Feature({Svg, title, description}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
