// site-routing.ts

export const Routes = {
  Home: '/',
  Knowledge: '/knowledge/',
  LearningPaths: '/learning-paths/',
  Retrospectives: '/retrospectives/',
  About: '/about/',
} as const;

export interface CategoryItem {
  id: string;
  label: string;
  slug: string;
  desc?: string;
  url?: string;
}

export interface SubcategoryItem {
  id: string;
  label: string;
}

export const KnowledgeCategories: CategoryItem[] = [
  { 
    id: 'java-backend', 
    label: 'Java 后端', 
    slug: 'knowledge/java-backend',
    url: '/knowledge/java-backend/', 
    desc: '语言与运行时、框架机制、数据一致性和真实工程问题。' 
  },
  { 
    id: 'database', 
    label: '数据库', 
    slug: 'knowledge/database', 
    url: '/knowledge/database/', 
    desc: '数据建模、查询机制、事务语义和性能诊断。' 
  },
  { 
    id: 'distributed-systems', 
    label: '分布式系统', 
    slug: 'knowledge/distributed-systems', 
    url: '/knowledge/distributed-systems/', 
    desc: '并发、消息、任务调度、可靠性与系统边界。' 
  },
  { 
    id: 'system-design', 
    label: '系统设计', 
    slug: 'knowledge/system-design', 
    url: '/knowledge/system-design/', 
    desc: '从业务约束到技术方案，记录取舍依据与演进路径。' 
  },
  { 
    id: 'engineering-practice', 
    label: '工程实践', 
    slug: 'knowledge/engineering-practice', 
    url: '/knowledge/engineering-practice/', 
    desc: '测试、交付、可观测性、代码质量和问题复盘方法。' 
  },
  {
    id: 'computer-fundamentals',
    label: '计算机基础',
    slug: 'knowledge/computer-fundamentals',
    url: '/knowledge/computer-fundamentals/',
    desc: '操作系统、计算机网络与 Web 基础协议。'
  },
  {
    id: 'algorithms',
    label: '数据结构与算法',
    slug: 'knowledge/algorithms',
    url: '/knowledge/algorithms/',
    desc: '数据结构、图论、排序与常用算法思想。'
  },
  {
    id: 'miscellaneous',
    label: '其他',
    slug: 'knowledge/miscellaneous',
    url: '/knowledge/miscellaneous/',
    desc: '暂时无法归入稳定专题、但仍需保留的历史文章。'
  },
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
    { id: 'business-design', label: '业务系统设计' },
  ],
  miscellaneous: [
    { id: 'personal-growth', label: '个人成长' },
  ],
};

export const TopLevelSections: CategoryItem[] = [
  { id: 'knowledge', label: '全部专题', slug: 'knowledge', url: '/knowledge/' },
  { id: 'learning-paths', label: '学习路线', slug: 'learning-paths', url: '/learning-paths/' },
  { id: 'retrospectives', label: '问题复盘', slug: 'retrospectives', url: '/retrospectives/' },
  { id: 'about', label: '关于本站', slug: 'about', url: '/about/' },
];
