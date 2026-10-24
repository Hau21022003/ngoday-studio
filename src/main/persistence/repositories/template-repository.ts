import type {
  Page,
  Template,
  TemplateAggregate,
  TemplateListQuery,
  TemplateSummary,
  TemplateVersion,
} from "../../../shared/domain"
import { StaleRevisionError } from "../../domain/errors"
import type { StudioDatabase } from "../database"
import { mapTemplate, mapTemplateSummary, mapTemplateVersion, type SqlRow } from "../row-mappers"

const summarySelect = `
  SELECT t.*,
    current_version.major AS current_major,
    current_version.minor AS current_minor,
    COUNT(DISTINCT batches.id) AS usage_count
  FROM prompt_templates t
  LEFT JOIN prompt_template_versions current_version
    ON current_version.id = (
      SELECT version.id
      FROM prompt_template_versions version
      WHERE version.template_id = t.id
      ORDER BY version.major DESC, version.minor DESC
      LIMIT 1
    )
  LEFT JOIN scene_import_batches batches
    ON batches.template_version_id IN (
      SELECT usage_version.id FROM prompt_template_versions usage_version WHERE usage_version.template_id = t.id
    )
`

export class TemplateRepository {
  constructor(private readonly database: StudioDatabase) {}

  list(query: TemplateListQuery): Page<TemplateSummary> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 25
    const conditions: string[] = []
    const values: Array<string | number> = []
    if (query.search?.trim()) {
      conditions.push("(t.name LIKE ? ESCAPE '\\' OR t.description LIKE ? ESCAPE '\\')")
      const escaped = query.search.trim().replace(/[\\%_]/g, "\\$&")
      values.push(`%${escaped}%`, `%${escaped}%`)
    }
    if (query.purpose) {
      conditions.push("t.purpose = ?")
      values.push(query.purpose)
    }
    if (query.status) {
      conditions.push("t.status = ?")
      values.push(query.status)
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""
    const totalRow = this.database.connection
      .prepare(`SELECT COUNT(*) AS total FROM prompt_templates t ${where}`)
      .get(...values) as SqlRow
    const rows = this.database.connection
      .prepare(`${summarySelect} ${where} GROUP BY t.id ORDER BY t.updated_at DESC LIMIT ? OFFSET ?`)
      .all(...values, pageSize, (page - 1) * pageSize) as SqlRow[]

    return { items: rows.map(mapTemplateSummary), page, pageSize, total: Number(totalRow.total) }
  }

  getById(id: string): TemplateAggregate | null {
    const row = this.database.connection
      .prepare(`${summarySelect} WHERE t.id = ? GROUP BY t.id`)
      .get(id) as SqlRow | undefined
    if (!row) return null
    const versions = this.database.connection
      .prepare("SELECT * FROM prompt_template_versions WHERE template_id = ? ORDER BY major DESC, minor DESC")
      .all(id) as SqlRow[]
    return { ...mapTemplateSummary(row), versions: versions.map(mapTemplateVersion) }
  }

  getVersionById(id: string): TemplateVersion | null {
    const row = this.database.connection
      .prepare("SELECT * FROM prompt_template_versions WHERE id = ?")
      .get(id) as SqlRow | undefined
    return row ? mapTemplateVersion(row) : null
  }

  insert(template: Template, version: TemplateVersion) {
    this.database.connection
      .prepare(`
        INSERT INTO prompt_templates (
          id, name, name_key, description, purpose, status, revision_no,
          created_by_name, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        template.id,
        template.name,
        template.nameKey,
        template.description,
        template.purpose,
        template.status,
        template.revisionNo,
        template.createdByName,
        template.createdAt,
        template.updatedAt,
      )
    this.insertVersion(version)
  }

  update(template: Template, expectedRevisionNo: number) {
    const result = this.database.connection
      .prepare(`
        UPDATE prompt_templates
        SET name = ?, name_key = ?, description = ?, purpose = ?, status = ?,
            revision_no = revision_no + 1, updated_at = ?
        WHERE id = ? AND revision_no = ?
      `)
      .run(
        template.name,
        template.nameKey,
        template.description,
        template.purpose,
        template.status,
        template.updatedAt,
        template.id,
        expectedRevisionNo,
      )
    if (Number(result.changes) !== 1) throw new StaleRevisionError("Template")
    const row = this.database.connection.prepare("SELECT * FROM prompt_templates WHERE id = ?").get(template.id) as SqlRow
    return mapTemplate(row)
  }

  appendVersion(version: TemplateVersion, expectedTemplateRevisionNo: number) {
    this.insertVersion(version)
    const result = this.database.connection
      .prepare("UPDATE prompt_templates SET revision_no = revision_no + 1, updated_at = ? WHERE id = ? AND revision_no = ?")
      .run(version.createdAt, version.templateId, expectedTemplateRevisionNo)
    if (Number(result.changes) !== 1) throw new StaleRevisionError("Template")
    return version
  }

  private insertVersion(version: TemplateVersion) {
    this.database.connection
      .prepare(`
        INSERT INTO prompt_template_versions (
          id, template_id, major, minor, content, variables_json, change_note,
          content_hash, created_by_name, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        version.id,
        version.templateId,
        version.major,
        version.minor,
        version.content,
        JSON.stringify(version.variables),
        version.changeNote,
        version.contentHash,
        version.createdByName,
        version.createdAt,
      )
  }
}
