import { z } from 'zod';
import { DomainError } from './errors.js';

export const scriptSceneSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    summary: z.string().max(10_000).default(''),
    narration: z.string().max(50_000).default(''),
    imagePrompt: z.string().max(50_000).default(''),
    videoPrompt: z.string().max(50_000).default(''),
  })
  .refine(
    (scene) =>
      [scene.summary, scene.narration, scene.imagePrompt, scene.videoPrompt].some(
        (value) => value.trim().length > 0,
      ),
    { message: 'Mỗi scene phải có ít nhất một trường nội dung.' },
  );

export const scriptImportSchema = z.object({
  schemaVersion: z.literal(1),
  title: z.string().max(200).optional(),
  scenes: z.array(scriptSceneSchema).min(1),
});

export type ScriptImport = z.infer<typeof scriptImportSchema>;
export type ScriptSceneInput = z.infer<typeof scriptSceneSchema>;
export type ScriptImportFormat = 'markdown' | 'json';

const sectionNames = {
  Summary: 'summary',
  Narration: 'narration',
  'Image Prompt': 'imagePrompt',
  'Video Prompt': 'videoPrompt',
} as const;

export function parseScript(source: string, format: ScriptImportFormat): ScriptImport {
  try {
    const candidate = format === 'json' ? JSON.parse(source) : parseMarkdown(source);
    return scriptImportSchema.parse(candidate);
  } catch (error) {
    if (error instanceof DomainError) throw error;
    if (error instanceof z.ZodError) {
      throw new DomainError(
        'IMPORT_INVALID',
        'Kịch bản không đúng schema v1.',
        error.issues.map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`),
      );
    }
    throw new DomainError('IMPORT_INVALID', 'Không thể đọc kịch bản.', [
      error instanceof Error ? error.message : String(error),
    ]);
  }
}

function parseMarkdown(source: string): ScriptImport {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  if (!lines.some((line) => line.trim() === '<!-- ngoday-script:v1 -->')) {
    throw new DomainError('IMPORT_INVALID', 'Markdown thiếu marker ngoday-script:v1.');
  }

  let title: string | undefined;
  const scenes: ScriptSceneInput[] = [];
  let current: ScriptSceneInput | null = null;
  let activeSection: keyof Omit<ScriptSceneInput, 'title'> | null = null;
  let expectedOrder = 1;

  const flush = () => {
    if (!current) return;
    for (const key of ['summary', 'narration', 'imagePrompt', 'videoPrompt'] as const) {
      current[key] = current[key].trim();
    }
    scenes.push(current);
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const sceneMatch = /^## Scene (\d+):\s*(.+)$/i.exec(line);
    if (sceneMatch) {
      const order = Number(sceneMatch[1]);
      if (order !== expectedOrder) {
        throw new DomainError(
          'IMPORT_INVALID',
          `Thứ tự scene phải liên tục; mong đợi Scene ${expectedOrder}.`,
        );
      }
      flush();
      current = {
        title: sceneMatch[2].trim(),
        summary: '',
        narration: '',
        imagePrompt: '',
        videoPrompt: '',
      };
      activeSection = null;
      expectedOrder += 1;
      continue;
    }

    const sectionMatch = /^### (.+)$/.exec(line);
    if (sectionMatch) {
      if (!current) {
        throw new DomainError('IMPORT_INVALID', 'Section nội dung phải nằm trong một scene.');
      }
      const key = sectionNames[sectionMatch[1] as keyof typeof sectionNames];
      if (!key) {
        throw new DomainError('IMPORT_INVALID', `Section không được hỗ trợ: ${sectionMatch[1]}`);
      }
      activeSection = key;
      continue;
    }

    if (!current && /^#\s+/.test(line) && !title) {
      title = line.replace(/^#\s+/, '').trim();
      continue;
    }

    if (current && line.trim() && !activeSection) {
      throw new DomainError(
        'IMPORT_INVALID',
        `Nội dung scene "${current.title}" phải nằm dưới một section ### hợp lệ.`,
      );
    }
    if (current && activeSection) {
      current[activeSection] += `${current[activeSection] ? '\n' : ''}${line}`;
    }
  }

  flush();
  return { schemaVersion: 1, title, scenes };
}

export function serializeScriptMarkdown(script: ScriptImport): string {
  const lines = ['<!-- ngoday-script:v1 -->'];
  if (script.title) lines.push(`# ${script.title}`, '');
  script.scenes.forEach((scene, index) => {
    lines.push(`## Scene ${index + 1}: ${scene.title}`);
    for (const [heading, key] of Object.entries(sectionNames)) {
      lines.push('', `### ${heading}`, scene[key].trim());
    }
    lines.push('');
  });
  return lines.join('\n').trimEnd() + '\n';
}
