// Knowledge areas live under src/content/docs/knowledge/<id>/<subcategory id>/.

export interface CategoryItem {
  id: string;
  label: string;
  desc: string;
}

export interface SubcategoryItem {
  id: string;
  label: string;
}

export const KnowledgeCategories: CategoryItem[] = [
  { id: 'java-backend', label: 'Java 后端', desc: '语言基础、集合、并发、JVM、Spring 与设计模式。' },
  { id: 'database', label: '数据库', desc: 'MySQL 存储、索引、SQL 执行、事务与锁、日志与复制。' },
  { id: 'distributed-systems', label: '分布式系统', desc: 'Redis、Kafka、分布式锁、缓存一致性与分库分表。' },
  { id: 'system-design', label: '系统设计', desc: '幂等、可靠消息等可复用的系统设计基础。' },
  { id: 'engineering-practice', label: '工程实践', desc: 'Git 与常用基础设施工具。' },
  { id: 'computer-fundamentals', label: '计算机基础', desc: '操作系统、计算机网络与 Web 基础协议。' },
  { id: 'algorithms', label: '数据结构与算法', desc: '线性结构、树与图、算法思想，以及可交互推演的算法课。' },
];

export const KnowledgeSubcategories: Record<string, SubcategoryItem[]> = {
  'java-backend': [
    { id: 'java-language', label: 'Java 语言基础' },
    { id: 'collections', label: '集合框架' },
    { id: 'concurrency', label: '并发编程' },
    { id: 'jvm-runtime', label: 'JVM 与运行时' },
    { id: 'spring', label: 'Spring 与安全' },
    { id: 'design-patterns', label: '设计模式' },
    { id: 'java-ecosystem', label: 'Java 生态与工程' },
  ],
  database: [
    { id: 'storage-modeling', label: '数据建模与存储' },
    { id: 'query-optimization', label: 'SQL 执行与优化' },
    { id: 'indexes', label: '索引原理与优化' },
    { id: 'transactions-locks', label: '事务与锁' },
    { id: 'logs-replication', label: '日志、复制与高可用' },
  ],
  'distributed-systems': [
    { id: 'redis-internals', label: 'Redis 数据结构与实现' },
    { id: 'redis-reliability', label: 'Redis 持久化与高可用' },
    { id: 'redis-practice', label: 'Redis 实践与性能' },
    { id: 'consistency', label: '一致性与分布式协调' },
    { id: 'kafka', label: 'Kafka 消息系统' },
  ],
  'computer-fundamentals': [
    { id: 'operating-systems', label: '操作系统' },
    { id: 'networking', label: '计算机网络' },
    { id: 'web-infrastructure', label: 'Web 与网络基础设施' },
  ],
  algorithms: [
    { id: 'linear-structures', label: '数组、链表与队列' },
    { id: 'algorithm-patterns', label: '算法思想与排序' },
    { id: 'trees-graphs', label: '树与图论' },
  ],
  'engineering-practice': [
    { id: 'version-control', label: '版本控制' },
    { id: 'infrastructure-tools', label: '工程与基础设施工具' },
  ],
  'system-design': [
    { id: 'foundations', label: '系统设计基础' },
  ],
};
