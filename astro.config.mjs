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
						...KnowledgeCategories.map(cat => ({ label: cat.label, slug: cat.slug })),
					],
				},
				{
					label: '探索',
					items: TopLevelSections.filter(s => s.id !== 'knowledge').map(s => ({
						label: s.label,
						slug: s.slug,
					})),
				},
			],
		}),
	],
});
