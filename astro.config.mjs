// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import vercel from '@astrojs/vercel';
import { KnowledgeCategories, KnowledgeSubcategories } from './src/config/site-routing';
import { CsdnRedirects } from './src/config/csdn-redirects.mjs';

// Starlight reads "last updated" dates from `git log`. Git escapes non-ASCII paths by
// default, which hides the date of every note with a Chinese file name.
process.env.GIT_CONFIG_COUNT = '1';
process.env.GIT_CONFIG_KEY_0 = 'core.quotepath';
process.env.GIT_CONFIG_VALUE_0 = 'false';

// https://astro.build/config
export default defineConfig({
	site: 'https://notes.ian2000.xyz',
	adapter: vercel(),
	vite: {
		build: {
			rolldownOptions: {
				treeshake: {
					// The Vercel adapter's runtime constants also import its build tooling.
					// Drop only the unused bundler import from the deployed function.
					moduleSideEffects: [
						{ test: /^rolldown$/, external: true, sideEffects: false },
						{ test: /.*/, sideEffects: true },
					],
				},
			},
		},
	},
	redirects: CsdnRedirects,
	integrations: [
		starlight({
			title: '学习档案',
			description: '记录、验证和沉淀可复用的技术知识',
			components: {
				Head: './src/components/Head.astro',
				PageTitle: './src/components/CustomPageTitle.astro',
				ThemeProvider: './src/components/LightThemeProvider.astro',
				ThemeSelect: './src/components/LightThemeSelect.astro',
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
						{ label: '全部专题', slug: 'knowledge' },
						...KnowledgeCategories.map(cat => ({
							label: cat.label,
							collapsed: true,
							items: [
								{ label: '专题概览', slug: `knowledge/${cat.id}` },
								...KnowledgeSubcategories[cat.id].map(subcategory => ({
									label: subcategory.label,
									collapsed: true,
									items: [{ autogenerate: { directory: `knowledge/${cat.id}/${subcategory.id}` } }],
								})),
							],
						})),
					],
				},
				{
					label: '探索',
					items: [
						{ label: '英语学习', link: '/english/' },
						{ label: '学习路线', slug: 'learning-paths' },
						{
							label: '问题复盘',
							collapsed: true,
							items: [
								{ label: '复盘概览', slug: 'retrospectives' },
								{
									label: '故障与问题复盘',
									items: [{ autogenerate: { directory: 'retrospectives/production-issues' } }],
								},
							],
						},
						{ label: '关于本站', slug: 'about' },
					],
				},
			],
		}),
	],
});
