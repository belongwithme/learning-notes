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

export const TopLevelSections: CategoryItem[] = [
  { id: 'knowledge', label: '全部专题', slug: 'knowledge', url: '/knowledge/' },
  { id: 'learning-paths', label: '学习路线', slug: 'learning-paths', url: '/learning-paths/' },
  { id: 'retrospectives', label: '问题复盘', slug: 'retrospectives', url: '/retrospectives/' },
  { id: 'about', label: '关于本站', slug: 'about', url: '/about/' },
];
