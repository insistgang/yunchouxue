import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const topics = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/topics' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    summary: z.string().max(160),
    difficulty: z.enum(['入门', '进阶', '高级']),
    readingTime: z.number().optional(),
    tags: z.array(z.string()).default([]),
    theme: z.enum(['线性规划', '图论', '网络流', '动态规划']),
    cover: image().optional(),
    coverAlt: z.string().default(''),
    hasInteractive: z.boolean().default(true),
    interactiveComponent: z.enum(['SimplexDemo','DijkstraDemo','MaxflowDemo','KnapsackDemo']).optional(),
    publishDate: z.coerce.date(),
    updatedDate: z.coerce.date(),
    prerequisites: z.array(z.string()).default([]),
    references: z.array(z.object({ label: z.string(), url: z.string().url() })).default([]),
    draft: z.boolean().default(false),
    order: z.number().default(0),
  }),
});
export const collections = { topics };
