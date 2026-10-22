export const phase1Migration = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE episodes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('draft', 'script_ready', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE prompt_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT '',
  current_version_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE prompt_template_versions (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES prompt_templates(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL CHECK (version_no > 0),
  content TEXT NOT NULL,
  allowed_variables_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (template_id, version_no)
);

CREATE TABLE scripts (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL UNIQUE REFERENCES episodes(id) ON DELETE CASCADE,
  current_revision_id TEXT,
  template_version_id TEXT REFERENCES prompt_template_versions(id),
  rendered_prompt_snapshot TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE script_revisions (
  id TEXT PRIMARY KEY,
  script_id TEXT NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  revision_no INTEGER NOT NULL CHECK (revision_no > 0),
  source TEXT NOT NULL CHECK (source IN ('manual', 'import', 'restore')),
  source_format TEXT NOT NULL CHECK (source_format IN ('editor', 'markdown', 'json')),
  raw_source TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  template_version_id TEXT REFERENCES prompt_template_versions(id),
  rendered_prompt_snapshot TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (script_id, revision_no)
);

CREATE TABLE scenes (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  scene_order INTEGER NOT NULL CHECK (scene_order > 0),
  title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  narration TEXT NOT NULL DEFAULT '',
  image_prompt TEXT NOT NULL DEFAULT '',
  video_prompt TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('draft', 'in_review', 'approved', 'needs_changes')),
  revision_no INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (episode_id, scene_order)
);

CREATE TABLE character_references (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  sha256 TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available', 'missing')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE asset_slots (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  asset_order INTEGER NOT NULL CHECK (asset_order > 0),
  canonical_name TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  required INTEGER NOT NULL CHECK (required IN (0, 1)),
  prompt TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (scene_id, asset_order),
  UNIQUE (episode_id, canonical_name)
);

CREATE TABLE asset_slot_references (
  asset_slot_id TEXT NOT NULL REFERENCES asset_slots(id) ON DELETE CASCADE,
  reference_id TEXT NOT NULL REFERENCES character_references(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL CHECK (position >= 0),
  PRIMARY KEY (asset_slot_id, reference_id),
  UNIQUE (asset_slot_id, position)
);

CREATE INDEX idx_episodes_updated_at ON episodes(updated_at DESC);
CREATE INDEX idx_scenes_episode_order ON scenes(episode_id, scene_order);
CREATE INDEX idx_asset_slots_scene_order ON asset_slots(scene_id, asset_order);
CREATE INDEX idx_references_episode ON character_references(episode_id);
`;
