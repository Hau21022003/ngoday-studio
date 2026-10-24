import type {
  CreateTemplateCommand,
  CreateTemplateVersionCommand,
  RenderTemplateCommand,
  RenderedPrompt,
  Template,
  TemplateListQuery,
  TemplateVariableDefinition,
  TemplateVersion,
  UpdateTemplateCommand,
} from "../../shared/domain"
import { DomainError, NotFoundError } from "../domain/errors"
import { canonicalJson, newId, normalizeKey, nowUtc, sha256 } from "../domain/helpers"
import type { StudioDatabase } from "../persistence/database"
import { TemplateRepository } from "../persistence/repositories/template-repository"
import { rethrowSqliteConstraint } from "../persistence/sqlite-errors"

function templateContentHash(content: string, variables: TemplateVariableDefinition[]) {
  return sha256(`${content}\n${canonicalJson(variables)}`)
}

function placeholders(content: string) {
  return [...content.matchAll(/{{\s*([a-z][a-z0-9_]*)\s*}}/g)].map((match) => match[1]!)
}

function validateVariableContract(content: string, variables: TemplateVariableDefinition[]) {
  const placeholderNames = new Set(placeholders(content))
  const definitionNames = new Set(variables.map((variable) => variable.name))
  const missingDefinitions = [...placeholderNames].filter((name) => !definitionNames.has(name))
  const unusedDefinitions = [...definitionNames].filter((name) => !placeholderNames.has(name))
  if (missingDefinitions.length > 0 || unusedDefinitions.length > 0) {
    throw new DomainError("VALIDATION_ERROR", "Placeholder và variable definition không khớp.", {
      fieldErrors: {
        ...(missingDefinitions.length > 0 ? { content: `Thiếu definition: ${missingDefinitions.join(", ")}` } : {}),
        ...(unusedDefinitions.length > 0 ? { variables: `Variable không được dùng: ${unusedDefinitions.join(", ")}` } : {}),
      },
    })
  }
}

export class TemplateService {
  constructor(
    private readonly database: StudioDatabase,
    private readonly templates: TemplateRepository,
  ) {}

  list(query: TemplateListQuery) {
    return this.templates.list(query)
  }

  get(id: string) {
    const template = this.templates.getById(id)
    if (!template) throw new NotFoundError("Template")
    return template
  }

  create(command: CreateTemplateCommand) {
    validateVariableContract(command.content, command.variables)
    const now = nowUtc()
    const template: Template = {
      id: newId(),
      name: command.name.trim(),
      nameKey: normalizeKey(command.name),
      description: command.description.trim(),
      purpose: command.purpose,
      status: command.status,
      revisionNo: 1,
      createdByName: command.createdByName.trim(),
      createdAt: now,
      updatedAt: now,
    }
    const version: TemplateVersion = {
      id: newId(),
      templateId: template.id,
      major: 1,
      minor: 0,
      content: command.content,
      variables: command.variables,
      changeNote: command.changeNote.trim(),
      contentHash: templateContentHash(command.content, command.variables),
      createdByName: command.createdByName.trim(),
      createdAt: now,
    }

    try {
      this.database.transaction(() => this.templates.insert(template, version))
      return this.get(template.id)
    } catch (error) {
      rethrowSqliteConstraint(error)
    }
  }

  updateMetadata(command: UpdateTemplateCommand) {
    const current = this.get(command.id)
    const next: Template = {
      ...current,
      ...command.patch,
      name: command.patch.name?.trim() ?? current.name,
      nameKey: command.patch.name ? normalizeKey(command.patch.name) : current.nameKey,
      description: command.patch.description?.trim() ?? current.description,
      updatedAt: nowUtc(),
    }
    try {
      return this.templates.update(next, command.expectedRevisionNo)
    } catch (error) {
      rethrowSqliteConstraint(error)
    }
  }

  createVersion(command: CreateTemplateVersionCommand) {
    validateVariableContract(command.content, command.variables)
    const aggregate = this.get(command.templateId)
    const latest = aggregate.versions[0]
    const version: TemplateVersion = {
      id: newId(),
      templateId: command.templateId,
      major: latest?.major ?? 1,
      minor: (latest?.minor ?? -1) + 1,
      content: command.content,
      variables: command.variables,
      changeNote: command.changeNote.trim(),
      contentHash: templateContentHash(command.content, command.variables),
      createdByName: command.createdByName.trim(),
      createdAt: nowUtc(),
    }
    try {
      return this.database.transaction(() =>
        this.templates.appendVersion(version, command.expectedTemplateRevisionNo),
      )
    } catch (error) {
      rethrowSqliteConstraint(error)
    }
  }

  render(command: RenderTemplateCommand): RenderedPrompt {
    const version = this.templates.getVersionById(command.templateVersionId)
    if (!version) throw new NotFoundError("TemplateVersion")
    const allowedNames = new Set(version.variables.map((variable) => variable.name))
    const unknownNames = Object.keys(command.values).filter((name) => !allowedNames.has(name))
    if (unknownNames.length > 0) {
      throw new DomainError("VALIDATION_ERROR", "Giá trị render chứa variable không được khai báo.", {
        fieldErrors: { values: unknownNames.join(", ") },
      })
    }

    const resolved = new Map<string, string>()
    for (const variable of version.variables) {
      const value = command.values[variable.name] ?? variable.defaultValue
      if (variable.required && value.trim().length === 0) {
        throw new DomainError("VALIDATION_ERROR", "Thiếu variable bắt buộc.", {
          fieldErrors: { [variable.name]: "Bắt buộc." },
        })
      }
      if (variable.type === "number" && value.trim() && !Number.isFinite(Number(value))) {
        throw new DomainError("VALIDATION_ERROR", "Variable number không hợp lệ.", {
          fieldErrors: { [variable.name]: "Phải là số." },
        })
      }
      if (variable.type === "select" && value && !variable.options.includes(value)) {
        throw new DomainError("VALIDATION_ERROR", "Giá trị select không hợp lệ.", {
          fieldErrors: { [variable.name]: "Không nằm trong options." },
        })
      }
      resolved.set(variable.name, value)
    }

    const content = version.content.replace(/{{\s*([a-z][a-z0-9_]*)\s*}}/g, (_match, name: string) => {
      if (!resolved.has(name)) throw new DomainError("VALIDATION_ERROR", `Không thể render variable ${name}.`)
      return resolved.get(name)!
    })
    return { templateVersionId: version.id, content, contentHash: sha256(content) }
  }
}
