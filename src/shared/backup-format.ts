import { z } from 'zod';

const timestamp = z.string().min(1);
const nullableText = z.string().nullable();

const episodeRow = z
  .object({
    id: z.string(),
    title: z.string(),
    topic: z.string(),
    slug: z.string(),
    notes: z.string(),
    status: z.enum(['draft', 'script_ready', 'archived']),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .strict();

const templateRow = z
  .object({
    id: z.string(),
    name: z.string(),
    purpose: z.string(),
    current_version_id: nullableText,
    created_at: timestamp,
    updated_at: timestamp,
  })
  .strict();

const templateVersionRow = z
  .object({
    id: z.string(),
    template_id: z.string(),
    version_no: z.number().int().positive(),
    content: z.string(),
    allowed_variables_json: z.string(),
    created_at: timestamp,
  })
  .strict();

const scriptRow = z
  .object({
    id: z.string(),
    episode_id: z.string(),
    current_revision_id: nullableText,
    template_version_id: nullableText,
    rendered_prompt_snapshot: nullableText,
    created_at: timestamp,
    updated_at: timestamp,
  })
  .strict();

const revisionRow = z
  .object({
    id: z.string(),
    script_id: z.string(),
    revision_no: z.number().int().positive(),
    source: z.enum(['manual', 'import', 'restore']),
    source_format: z.enum(['editor', 'markdown', 'json']),
    raw_source: z.string(),
    snapshot_json: z.string(),
    template_version_id: nullableText,
    rendered_prompt_snapshot: nullableText,
    created_at: timestamp,
  })
  .strict();

const sceneRow = z
  .object({
    id: z.string(),
    episode_id: z.string(),
    scene_order: z.number().int().positive(),
    title: z.string(),
    summary: z.string(),
    narration: z.string(),
    image_prompt: z.string(),
    video_prompt: z.string(),
    status: z.enum(['draft', 'in_review', 'approved', 'needs_changes']),
    revision_no: z.number().int().nonnegative(),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .strict();

const referenceRow = z
  .object({
    id: z.string(),
    episode_id: z.string(),
    name: z.string(),
    source_path: z.string(),
    mime_type: z.string(),
    size_bytes: z.number().int().nonnegative(),
    sha256: z.string(),
    status: z.enum(['available', 'missing']),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .strict();

const assetSlotRow = z
  .object({
    id: z.string(),
    episode_id: z.string(),
    scene_id: z.string(),
    asset_order: z.number().int().positive(),
    canonical_name: z.string(),
    media_type: z.enum(['image', 'video']),
    required: z.union([z.literal(0), z.literal(1)]),
    prompt: z.string(),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .strict();

const assetReferenceRow = z
  .object({
    asset_slot_id: z.string(),
    reference_id: z.string(),
    position: z.number().int().nonnegative(),
  })
  .strict();

export const backupEnvelopeSchema = z
  .object({
    format: z.literal('ngoday-backup'),
    schemaVersion: z.literal(1),
    exportedAt: timestamp,
    tables: z
      .object({
        episodes: z.array(episodeRow),
        prompt_templates: z.array(templateRow),
        prompt_template_versions: z.array(templateVersionRow),
        scripts: z.array(scriptRow),
        script_revisions: z.array(revisionRow),
        scenes: z.array(sceneRow),
        character_references: z.array(referenceRow),
        asset_slots: z.array(assetSlotRow),
        asset_slot_references: z.array(assetReferenceRow),
      })
      .strict(),
  })
  .strict();

export type BackupEnvelope = z.infer<typeof backupEnvelopeSchema>;
