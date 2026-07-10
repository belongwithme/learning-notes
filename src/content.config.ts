import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { z } from 'astro/zod';

export const collections = {
	docs: defineCollection({
		loader: docsLoader(),
		schema: docsSchema({
			extend: z.object({
				created: z.coerce.date().optional(),
				updated: z.coerce.date().optional(),
				category: z.string().optional(),
				tags: z.array(z.string()).default([]),
				status: z.enum(['draft', 'verified', 'evergreen', 'outdated']).optional(),
				difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
				contentType: z
					.enum(['knowledge', 'practice', 'retrospective', 'source-analysis', 'learning-path'])
					.optional(),
				source: z.string().optional(),
			}),
		}),
	}),
};
