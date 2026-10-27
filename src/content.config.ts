import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { z } from 'astro/zod';

export const collections = {
	docs: defineCollection({
		loader: docsLoader(),
		schema: docsSchema({
			extend: z.object({
				// Shown next to the title for every value except `draft`.
				status: z.enum(['draft', 'verified', 'evergreen', 'outdated']).optional(),
			}),
		}),
	}),
};
