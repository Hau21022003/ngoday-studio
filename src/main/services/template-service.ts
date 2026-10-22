import { randomUUID } from 'node:crypto';
import type { PromptTemplate, PromptTemplateVersion, TemplateDetail } from '../../shared/domain.js';
import {
  templateCreateSchema,
  templateRenderSchema,
  templateVersionCreateSchema,
} from '../../shared/schemas.js';
import { renderTemplate, validateTemplate } from '../../shared/template-renderer.js';
import type { StudioRepository } from '../repositories/studio-repository.js';

export class TemplateService {
  constructor(private readonly repository: StudioRepository) {}

  create(input: unknown): TemplateDetail {
    const parsed = templateCreateSchema.parse(input);
    const now = new Date().toISOString();
    const variables = validateTemplate(parsed.content);
    const templateId = randomUUID();
    const version: PromptTemplateVersion = {
      id: randomUUID(),
      templateId,
      versionNo: 1,
      content: parsed.content,
      allowedVariables: variables,
      createdAt: now,
    };
    const template: PromptTemplate = {
      id: templateId,
      name: parsed.name,
      purpose: parsed.purpose,
      currentVersionId: version.id,
      createdAt: now,
      updatedAt: now,
    };
    return this.repository.createTemplate(template, version);
  }

  createVersion(input: unknown): PromptTemplateVersion {
    const parsed = templateVersionCreateSchema.parse(input);
    const variables = validateTemplate(parsed.content);
    return this.repository.addTemplateVersion({
      id: randomUUID(),
      templateId: parsed.templateId,
      versionNo: this.repository.nextTemplateVersionNo(parsed.templateId),
      content: parsed.content,
      allowedVariables: variables,
      createdAt: new Date().toISOString(),
    });
  }

  list(): TemplateDetail[] {
    return this.repository.listTemplates();
  }

  render(input: unknown): { rendered: string; templateVersionId: string } {
    const parsed = templateRenderSchema.parse(input);
    const version = this.repository.getTemplateVersion(parsed.templateVersionId);
    const episode = this.repository.getEpisode(parsed.episodeId);
    const rendered = renderTemplate(version.content, {
      topic: episode.topic,
      episode_title: episode.title,
      notes: episode.notes,
    });
    this.repository.saveRenderedPrompt(episode.id, version.id, rendered, new Date().toISOString());
    return { rendered, templateVersionId: version.id };
  }
}
