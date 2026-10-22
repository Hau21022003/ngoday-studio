import { DomainError } from './errors.js';

export const allowedTemplateVariables = ['topic', 'episode_title', 'notes'] as const;
export type TemplateVariable = (typeof allowedTemplateVariables)[number];
export type TemplateContext = Partial<Record<TemplateVariable, string>>;

const variablePattern = /{{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*}}/g;

export function extractTemplateVariables(content: string): string[] {
  return [...new Set([...content.matchAll(variablePattern)].map((match) => match[1]))];
}

export function validateTemplate(content: string): TemplateVariable[] {
  if (!content.trim()) {
    throw new DomainError('TEMPLATE_INVALID', 'Nội dung template không được để trống.');
  }

  const variables = extractTemplateVariables(content);
  const unmatchedSyntax =
    content.replace(variablePattern, '').includes('{{') ||
    content.replace(variablePattern, '').includes('}}');
  if (unmatchedSyntax) {
    throw new DomainError('TEMPLATE_INVALID', 'Template có cú pháp biến không hoàn chỉnh.');
  }
  const unsupported = variables.filter(
    (variable) => !allowedTemplateVariables.includes(variable as TemplateVariable),
  );
  if (unsupported.length > 0) {
    throw new DomainError(
      'TEMPLATE_INVALID',
      'Template chứa biến không được hỗ trợ.',
      unsupported.map((variable) => `{{${variable}}}`),
    );
  }
  return variables as TemplateVariable[];
}

export function renderTemplate(content: string, context: TemplateContext): string {
  const variables = validateTemplate(content);
  const missing = variables.filter((variable) => context[variable] === undefined);
  if (missing.length > 0) {
    throw new DomainError(
      'TEMPLATE_INVALID',
      'Thiếu dữ liệu để render template.',
      missing.map((variable) => `{{${variable}}}`),
    );
  }

  return content.replace(variablePattern, (_match, variable: TemplateVariable) => {
    return context[variable] ?? '';
  });
}
