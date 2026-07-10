// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { KnowledgeCategories, TopLevelSections } from './src/config/site-routing';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: '学习档案',
			description: '记录、验证和沉淀可复用的技术知识',
			components: {
				Head: './src/components/SpeedInsights.astro',
				PageTitle: './src/components/CustomPageTitle.astro',
			},
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
							{ label: '全部专题', slug: TopLevelSections.find(s => s.id === 'knowledge')?.slug || 'knowledge' },
							...KnowledgeCategories.map(cat => ({
								label: cat.label,
								items: [{ autogenerate: { directory: cat.slug, collapsed: true } }],
							})),
						],
					},
					{
						label: '探索',
						items: [
							{ label: '学习路线', slug: 'learning-paths' },
							{ label: '问题复盘', items: [{ autogenerate: { directory: 'retrospectives', collapsed: true } }] },
							{ label: '关于本站', slug: 'about' },
						],
					},
				],
		}),
	],
});
