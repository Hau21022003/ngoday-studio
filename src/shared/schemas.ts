import { z } from 'zod';
import { episodeStatuses, mediaTypes, sceneStatuses } from './domain.js';

const idSchema = z.string().uuid();
const nonBlank = z.string().trim().min(1);

export const episodeCreateSchema = z.object({
  title: nonBlank.max(160),
  topic: nonBlank.max(300),
  slug: nonBlank.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),
  notes: z.string().max(10_000).default(''),
});

export const episodeUpdateSchema = episodeCreateSchema.extend({
  id: idSchema,
  status: z.enum(episodeStatuses),
});

export const episodeListSchema = z.object({
  query: z.string().max(200).default(''),
  includeArchived: z.boolean().default(false),
});

export const templateCreateSchema = z.object({
  name: nonBlank.max(160),
  purpose: z.string().max(500).default(''),
  content: nonBlank.max(50_000),
});

export const templateVersionCreateSchema = z.object({
  templateId: idSchema,
  content: nonBlank.max(50_000),
});

export const templateRenderSchema = z.object({
  templateVersionId: idSchema,
  episodeId: idSchema,
});

export const sceneCreateSchema = z.object({
  episodeId: idSchema,
  title: z.string().max(200).default(''),
  summary: z.string().max(10_000).default(''),
  narration: z.string().max(50_000).default(''),
  imagePrompt: z.string().max(50_000).default(''),
  videoPrompt: z.string().max(50_000).default(''),
});

export const sceneUpdateSchema = sceneCreateSchema.omit({ episodeId: true }).extend({
  id: idSchema,
  revisionNo: z.number().int().nonnegative(),
});

export const sceneStatusSchema = z.object({
  id: idSchema,
  status: z.enum(sceneStatuses),
});

export const sceneReorderSchema = z.object({
  episodeId: idSchema,
  orderedSceneIds: z.array(idSchema).min(1),
  confirmed: z.boolean().default(false),
});

export const assetSlotCreateSchema = z.object({
  sceneId: idSchema,
  mediaType: z.enum(mediaTypes),
  required: z.boolean().default(true),
  prompt: z.string().max(50_000).default(''),
});

export const assetSlotUpdateSchema = z.object({
  id: idSchema,
  mediaType: z.enum(mediaTypes),
  required: z.boolean(),
  prompt: z.string().max(50_000),
  referenceIds: z.array(idSchema),
});

export const idInputSchema = z.object({ id: idSchema });

export type EpisodeCreateInput = z.input<typeof episodeCreateSchema>;
export type EpisodeUpdateInput = z.input<typeof episodeUpdateSchema>;
export type SceneCreateInput = z.input<typeof sceneCreateSchema>;
export type SceneUpdateInput = z.input<typeof sceneUpdateSchema>;
export type AssetSlotCreateInput = z.input<typeof assetSlotCreateSchema>;
export type AssetSlotUpdateInput = z.input<typeof assetSlotUpdateSchema>;
