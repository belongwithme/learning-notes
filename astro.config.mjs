// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: '学习档案',
			description: '记录、验证和沉淀可复用的技术知识',
			locales: {
				root: { label: '简体中文', lang: 'zh-CN' },
			},
			customCss: ['./src/styles/custom.css'],
			credits: false,
			lastUpdated: true,
			sidebar: [
				{
					label: '专题索引',
					items: [
						{ label: '全部专题', slug: 'knowledge' },
						{ label: 'Java 后端', slug: 'knowledge/java-backend' },
						{ label: '数据库', slug: 'knowledge/database' },
						{ label: '分布式系统', slug: 'knowledge/distributed-systems' },
						{ label: '系统设计', slug: 'knowledge/system-design' },
						{ label: '工程实践', slug: 'knowledge/engineering-practice' },
					],
				},
				{
					label: '探索',
					items: [
						{ label: '学习路线', slug: 'learning-paths' },
						{ label: '问题复盘', slug: 'retrospectives' },
						{ label: '关于本站', slug: 'about' },
					],
				},
			],
		}),
	],
});
