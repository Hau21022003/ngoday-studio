import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DomainError } from '../../src/shared/errors.js';
import { parseScript, serializeScriptMarkdown } from '../../src/shared/script-format.js';

const markdown = readFileSync(new URL('../fixtures/script-v1-valid.md', import.meta.url), 'utf8');
const json = readFileSync(new URL('../fixtures/script-v1-valid.json', import.meta.url), 'utf8');
const invalidMarkdown = readFileSync(
  new URL('../fixtures/script-v1-invalid.md', import.meta.url),
  'utf8',
);

describe('script import format', () => {
  it('parses deterministic Markdown in scene order', () => {
    const parsed = parseScript(markdown, 'markdown');
    expect(parsed.title).toBe('Paper Boat');
    expect(parsed.scenes).toHaveLength(2);
    expect(parsed.scenes[1].title).toBe('Fold');
    expect(parsed.scenes[1].videoPrompt).toBe('Hands fold the sheet.');
  });

  it('round-trips the published Markdown structure', () => {
    const parsed = parseScript(markdown, 'markdown');
    expect(parseScript(serializeScriptMarkdown(parsed), 'markdown')).toEqual(parsed);
  });

  it('rejects missing markers and non-contiguous scene order', () => {
    expect(() =>
      parseScript(markdown.replace('<!-- ngoday-script:v1 -->', ''), 'markdown'),
    ).toThrow(DomainError);
    expect(() => parseScript(invalidMarkdown, 'markdown')).toThrow(DomainError);
    expect(() => parseScript(markdown.replace('## Scene 2:', '## Scene 3:'), 'markdown')).toThrow(
      'Thứ tự scene phải liên tục',
    );
  });

  it('validates JSON before returning any scenes', () => {
    expect(parseScript(json, 'json').scenes[0].summary).toBe('A quiet table.');
    expect(() => parseScript('{"schemaVersion":1,"scenes":[]}', 'json')).toThrow(
      'không đúng schema',
    );
  });
});
