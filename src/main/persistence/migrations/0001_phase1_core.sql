PRAGMA foreign_keys = ON;

CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL,
  app_version TEXT NOT NULL
) STRICT;

CREATE TABLE prompt_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('scene','thumbnail','hook','description','idea','other')),
  status TEXT NOT NULL CHECK (status IN ('experimental','active','inactive')),
  revision_no INTEGER NOT NULL DEFAULT 1 CHECK (revision_no >= 1),
  created_by_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (length(trim(name)) BETWEEN 3 AND 80),
  CHECK (length(trim(description)) BETWEEN 10 AND 240)
) STRICT;

CREATE TABLE prompt_template_versions (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES prompt_templates(id) ON DELETE RESTRICT,
  major INTEGER NOT NULL DEFAULT 1 CHECK (major >= 1),
  minor INTEGER NOT NULL CHECK (minor >= 0),
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 20000),
  variables_json TEXT NOT NULL CHECK (json_valid(variables_json)),
  change_note TEXT NOT NULL CHECK (length(trim(change_note)) BETWEEN 3 AND 160),
  content_hash TEXT NOT NULL CHECK (length(content_hash) = 64),
  created_by_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (template_id, major, minor)
) STRICT;

CREATE INDEX ix_template_versions_current
  ON prompt_template_versions(template_id, major DESC, minor DESC);

CREATE TABLE episodes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  slug_key TEXT NOT NULL UNIQUE,
  topic TEXT NOT NULL CHECK (topic IN ('animals','health','history','psychology','science')),
  description TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  thumbnail_relative_path TEXT,
  revision_no INTEGER NOT NULL DEFAULT 1 CHECK (revision_no >= 1),
  created_by_name TEXT NOT NULL,
  updated_by_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  CHECK (length(trim(title)) BETWEEN 3 AND 100),
  CHECK (length(trim(description)) BETWEEN 10 AND 240),
  CHECK (length(notes) <= 240)
) STRICT;

CREATE TABLE scene_import_batches (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE RESTRICT,
  template_version_id TEXT NOT NULL REFERENCES prompt_template_versions(id) ON DELETE RESTRICT,
  mode TEXT NOT NULL CHECK (mode IN ('append','replace')),
  payload_hash TEXT NOT NULL CHECK (length(payload_hash) = 64),
  rendered_prompt_hash TEXT CHECK (rendered_prompt_hash IS NULL OR length(rendered_prompt_hash) = 64),
  scene_count INTEGER NOT NULL CHECK (scene_count BETWEEN 1 AND 200),
  created_at TEXT NOT NULL,
  UNIQUE (id, episode_id)
) STRICT;

CREATE INDEX ix_scene_import_batches_episode
  ON scene_import_batches(episode_id, created_at);

CREATE TABLE scenes (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE RESTRICT,
  display_order INTEGER NOT NULL CHECK (display_order >= 1),
  canonical_no INTEGER NOT NULL CHECK (canonical_no >= 1),
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  narration TEXT NOT NULL DEFAULT '',
  visual_description TEXT NOT NULL DEFAULT '',
  scene_type TEXT NOT NULL CHECK (scene_type IN ('MAIN_CHARACTER','ENVIRONMENT','SCIENTIFIC_VISUALIZATION','MOTION_GRAPHIC','B_ROLL')),
  default_media_type TEXT NOT NULL CHECK (default_media_type IN ('image','video')),
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','approved','needs_changes')),
  source_import_batch_id TEXT,
  revision_no INTEGER NOT NULL DEFAULT 1 CHECK (revision_no >= 1),
  approved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (source_import_batch_id, episode_id) REFERENCES scene_import_batches(id, episode_id) ON DELETE RESTRICT,
  UNIQUE (id, episode_id),
  UNIQUE (episode_id, display_order),
  UNIQUE (episode_id, canonical_no),
  CHECK (length(trim(title)) BETWEEN 1 AND 120),
  CHECK (length(summary) <= 500),
  CHECK (length(narration) <= 10000),
  CHECK (length(visual_description) <= 5000),
  CHECK (length(notes) <= 2000),
  CHECK (status <> 'approved' OR (length(trim(narration)) > 0 AND length(trim(visual_description)) > 0 AND approved_at IS NOT NULL)),
  CHECK (status = 'approved' OR approved_at IS NULL)
) STRICT;

CREATE TABLE asset_slots (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL,
  scene_id TEXT NOT NULL,
  slot_order INTEGER NOT NULL CHECK (slot_order BETWEEN 1 AND 999),
  canonical_name TEXT NOT NULL,
  canonical_name_key TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image','video')),
  prompt TEXT NOT NULL DEFAULT '' CHECK (length(prompt) <= 20000),
  required INTEGER NOT NULL DEFAULT 1 CHECK (required IN (0,1)),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','fulfilled')),
  revision_no INTEGER NOT NULL DEFAULT 1 CHECK (revision_no >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (scene_id, episode_id) REFERENCES scenes(id, episode_id) ON DELETE RESTRICT,
  UNIQUE (scene_id, slot_order),
  UNIQUE (episode_id, canonical_name_key)
) STRICT;

CREATE INDEX ix_asset_slots_episode ON asset_slots(episode_id, scene_id, slot_order);

CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  asset_slot_id TEXT NOT NULL REFERENCES asset_slots(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('candidate','accepted','rejected')),
  origin TEXT NOT NULL CHECK (origin IN ('imported','generated')),
  prompt_snapshot TEXT NOT NULL DEFAULT '' CHECK (length(prompt_snapshot) <= 20000),
  relative_path TEXT,
  preview_relative_path TEXT,
  file_name TEXT,
  mime_type TEXT,
  bytes INTEGER CHECK (bytes IS NULL OR bytes >= 0),
  sha256 TEXT CHECK (sha256 IS NULL OR length(sha256) = 64),
  width INTEGER CHECK (width IS NULL OR width > 0),
  height INTEGER CHECK (height IS NULL OR height > 0),
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms > 0),
  revision_no INTEGER NOT NULL DEFAULT 1 CHECK (revision_no >= 1),
  created_at TEXT NOT NULL,
  accepted_at TEXT,
  rejected_at TEXT,
  archived_at TEXT,
  CHECK (status <> 'accepted' OR accepted_at IS NOT NULL),
  CHECK (status <> 'rejected' OR rejected_at IS NOT NULL)
) STRICT;

CREATE UNIQUE INDEX ux_assets_one_accepted_per_slot
  ON assets(asset_slot_id)
  WHERE status = 'accepted' AND archived_at IS NULL;

CREATE UNIQUE INDEX ux_assets_active_relative_path
  ON assets(relative_path)
  WHERE relative_path IS NOT NULL AND archived_at IS NULL;
