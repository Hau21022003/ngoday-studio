import { describe, expect, it } from 'vitest';
import { DomainError } from '../../src/shared/errors.js';
import {
  extractTemplateVariables,
  renderTemplate,
  validateTemplate,
} from '../../src/shared/template-renderer.js';

describe('template renderer', () => {
  it('extracts unique supported variables and renders an Episode context', () => {
    const content = '{{episode_title}} — {{topic}}\n{{notes}}\n{{topic}}';
    expect(extractTemplateVariables(content)).toEqual(['episode_title', 'topic', 'notes']);
    expect(
      renderTemplate(content, {
        episode_title: 'Pilot',
        topic: 'Origami',
        notes: 'Minimal',
      }),
    ).toBe('Pilot — Origami\nMinimal\nOrigami');
  });

  it('reports unsupported variables before rendering', () => {
    expect(() => validateTemplate('Hello {{unknown}}')).toThrowError(DomainError);
    try {
      validateTemplate('Hello {{unknown}}');
    } catch (error) {
      expect((error as DomainError).details).toEqual(['{{unknown}}']);
    }
  });

  it('reports a missing context value before rendering', () => {
    expect(() => renderTemplate('{{topic}} / {{notes}}', { topic: 'Paper' })).toThrow(
      'Thiếu dữ liệu',
    );
  });

  it('rejects malformed variable syntax', () => {
    expect(() => validateTemplate('Write about {{topic}')).toThrow('cú pháp biến không hoàn chỉnh');
  });
});
