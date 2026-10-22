import { z } from 'zod';
import type {
  AssetSlot,
  CharacterReference,
  Episode,
  EpisodeDetail,
  PromptTemplateVersion,
  Scene,
  ScriptRevision,
  TemplateDetail,
} from './domain.js';
import {
  assetSlotCreateSchema,
  assetSlotUpdateSchema,
  episodeCreateSchema,
  episodeListSchema,
  episodeUpdateSchema,
  idInputSchema,
  sceneCreateSchema,
  sceneReorderSchema,
  sceneUpdateSchema,
  templateCreateSchema,
  templateRenderSchema,
  templateVersionCreateSchema,
} from './schemas.js';

export const episodeSchema = z.object({
  id: z.string(),
  title: z.string(),
  topic: z.string(),
  slug: z.string(),
  notes: z.string(),
  status: z.enum(['draft', 'script_ready', 'archived']),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const sceneSchema = z.object({
  id: z.string(),
  episodeId: z.string(),
  sceneOrder: z.number(),
  title: z.string(),
  summary: z.string(),
  narration: z.string(),
  imagePrompt: z.string(),
  videoPrompt: z.string(),
  status: z.enum(['draft', 'in_review', 'approved', 'needs_changes']),
  revisionNo: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const assetSlotSchema = z.object({
  id: z.string(),
  episodeId: z.string(),
  sceneId: z.string(),
  assetOrder: z.number(),
  canonicalName: z.string(),
  mediaType: z.enum(['image', 'video']),
  required: z.boolean(),
  prompt: z.string(),
  referenceIds: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const referenceSchema = z.object({
  id: z.string(),
  episodeId: z.string(),
  name: z.string(),
  sourcePath: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  sha256: z.string(),
  status: z.enum(['available', 'missing']),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const scriptSchema = z.object({
  id: z.string(),
  episodeId: z.string(),
  currentRevisionId: z.string().nullable(),
  templateVersionId: z.string().nullable(),
  renderedPromptSnapshot: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const episodeDetailSchema = z.object({
  episode: episodeSchema,
  script: scriptSchema,
  scenes: z.array(sceneSchema.extend({ assetSlots: z.array(assetSlotSchema) })),
  references: z.array(referenceSchema),
});

export const templateVersionSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  versionNo: z.number(),
  content: z.string(),
  allowedVariables: z.array(z.string()),
  createdAt: z.string(),
});

export const templateDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  purpose: z.string(),
  currentVersionId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  versions: z.array(templateVersionSchema),
});

export const revisionSchema = z.object({
  id: z.string(),
  scriptId: z.string(),
  revisionNo: z.number(),
  source: z.enum(['manual', 'import', 'restore']),
  sourceFormat: z.enum(['editor', 'markdown', 'json']),
  rawSource: z.string(),
  snapshotJson: z.string(),
  templateVersionId: z.string().nullable(),
  renderedPromptSnapshot: z.string().nullable(),
  createdAt: z.string(),
});

export const importScriptRequestSchema = z.object({
  episodeId: z.string().uuid(),
  format: z.enum(['markdown', 'json']),
  source: z.string().min(1).max(2_000_000),
  replaceConfirmed: z.boolean().default(false),
});

export const reorderPreviewSchema = sceneReorderSchema.omit({ confirmed: true });
export const canonicalChangesSchema = z.array(
  z.object({ slotId: z.string(), from: z.string(), to: z.string() }),
);

export const renderResultSchema = z.object({
  rendered: z.string(),
  templateVersionId: z.string(),
});

export const operationResultSchema = z.object({
  completed: z.boolean(),
  path: z.string().optional(),
  message: z.string().optional(),
});

export interface StudioApiErrorShape {
  code: string;
  message: string;
  details: string[];
}

export type RpcResult<T> = { ok: true; data: T } | { ok: false; error: StudioApiErrorShape };

export interface StudioApi {
  episodes: {
    list(input?: { query?: string; includeArchived?: boolean }): Promise<Episode[]>;
    create(input: z.input<typeof episodeCreateSchema>): Promise<Episode>;
    update(input: z.input<typeof episodeUpdateSchema>): Promise<Episode>;
    archive(id: string): Promise<Episode>;
    detail(id: string): Promise<EpisodeDetail>;
  };
  templates: {
    list(): Promise<TemplateDetail[]>;
    create(input: z.input<typeof templateCreateSchema>): Promise<TemplateDetail>;
    createVersion(
      input: z.input<typeof templateVersionCreateSchema>,
    ): Promise<PromptTemplateVersion>;
    render(
      input: z.input<typeof templateRenderSchema>,
    ): Promise<{ rendered: string; templateVersionId: string }>;
  };
  scenes: {
    create(input: z.input<typeof sceneCreateSchema>): Promise<Scene>;
    update(input: z.input<typeof sceneUpdateSchema>): Promise<Scene>;
    delete(id: string): Promise<void>;
    previewReorder(
      input: z.input<typeof reorderPreviewSchema>,
    ): Promise<Array<{ slotId: string; from: string; to: string }>>;
    reorder(
      input: z.input<typeof sceneReorderSchema>,
    ): Promise<Array<{ slotId: string; from: string; to: string }>>;
    import(input: z.input<typeof importScriptRequestSchema>): Promise<ScriptRevision>;
    approve(id: string): Promise<void>;
    saveRevision(episodeId: string): Promise<ScriptRevision>;
    listRevisions(episodeId: string): Promise<ScriptRevision[]>;
  };
  assets: {
    create(input: z.input<typeof assetSlotCreateSchema>): Promise<AssetSlot>;
    update(input: z.input<typeof assetSlotUpdateSchema>): Promise<AssetSlot>;
    delete(id: string): Promise<void>;
    addReference(episodeId: string): Promise<CharacterReference | null>;
    refreshReferences(episodeId: string): Promise<CharacterReference[]>;
    deleteReference(id: string): Promise<void>;
  };
  backup: {
    export(): Promise<z.infer<typeof operationResultSchema>>;
    restore(): Promise<z.infer<typeof operationResultSchema>>;
  };
}

export const ipcSchemas = {
  'episodes:list': [episodeListSchema, z.array(episodeSchema)],
  'episodes:create': [episodeCreateSchema, episodeSchema],
  'episodes:update': [episodeUpdateSchema, episodeSchema],
  'episodes:archive': [idInputSchema, episodeSchema],
  'episodes:detail': [idInputSchema, episodeDetailSchema],
  'templates:list': [z.null(), z.array(templateDetailSchema)],
  'templates:create': [templateCreateSchema, templateDetailSchema],
  'templates:create-version': [templateVersionCreateSchema, templateVersionSchema],
  'templates:render': [templateRenderSchema, renderResultSchema],
  'scenes:create': [sceneCreateSchema, sceneSchema],
  'scenes:update': [sceneUpdateSchema, sceneSchema],
  'scenes:delete': [idInputSchema, z.null()],
  'scenes:preview-reorder': [reorderPreviewSchema, canonicalChangesSchema],
  'scenes:reorder': [sceneReorderSchema, canonicalChangesSchema],
  'scenes:import': [importScriptRequestSchema, revisionSchema],
  'scenes:approve': [idInputSchema, z.null()],
  'scenes:save-revision': [idInputSchema, revisionSchema],
  'scenes:list-revisions': [idInputSchema, z.array(revisionSchema)],
  'assets:create': [assetSlotCreateSchema, assetSlotSchema],
  'assets:update': [assetSlotUpdateSchema, assetSlotSchema],
  'assets:delete': [idInputSchema, z.null()],
  'references:add': [idInputSchema, referenceSchema.nullable()],
  'references:refresh': [idInputSchema, z.array(referenceSchema)],
  'references:delete': [idInputSchema, z.null()],
  'backup:export': [z.null(), operationResultSchema],
  'backup:restore': [z.null(), operationResultSchema],
} as const satisfies Record<string, readonly [z.ZodType, z.ZodType]>;

export type IpcChannel = keyof typeof ipcSchemas;
