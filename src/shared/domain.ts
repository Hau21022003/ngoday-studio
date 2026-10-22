export const episodeStatuses = ['draft', 'script_ready', 'archived'] as const;
export type EpisodeStatus = (typeof episodeStatuses)[number];

export const sceneStatuses = ['draft', 'in_review', 'approved', 'needs_changes'] as const;
export type SceneStatus = (typeof sceneStatuses)[number];

export const mediaTypes = ['image', 'video'] as const;
export type MediaType = (typeof mediaTypes)[number];

export const referenceStatuses = ['available', 'missing'] as const;
export type ReferenceStatus = (typeof referenceStatuses)[number];

export interface Episode {
  id: string;
  title: string;
  topic: string;
  slug: string;
  notes: string;
  status: EpisodeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  purpose: string;
  currentVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PromptTemplateVersion {
  id: string;
  templateId: string;
  versionNo: number;
  content: string;
  allowedVariables: string[];
  createdAt: string;
}

export interface Script {
  id: string;
  episodeId: string;
  currentRevisionId: string | null;
  templateVersionId: string | null;
  renderedPromptSnapshot: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScriptRevision {
  id: string;
  scriptId: string;
  revisionNo: number;
  source: 'manual' | 'import' | 'restore';
  sourceFormat: 'editor' | 'markdown' | 'json';
  rawSource: string;
  snapshotJson: string;
  templateVersionId: string | null;
  renderedPromptSnapshot: string | null;
  createdAt: string;
}

export interface Scene {
  id: string;
  episodeId: string;
  sceneOrder: number;
  title: string;
  summary: string;
  narration: string;
  imagePrompt: string;
  videoPrompt: string;
  status: SceneStatus;
  revisionNo: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssetSlot {
  id: string;
  episodeId: string;
  sceneId: string;
  assetOrder: number;
  canonicalName: string;
  mediaType: MediaType;
  required: boolean;
  prompt: string;
  referenceIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CharacterReference {
  id: string;
  episodeId: string;
  name: string;
  sourcePath: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  status: ReferenceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EpisodeDetail {
  episode: Episode;
  script: Script;
  scenes: Array<Scene & { assetSlots: AssetSlot[] }>;
  references: CharacterReference[];
}

export interface TemplateDetail extends PromptTemplate {
  versions: PromptTemplateVersion[];
}
