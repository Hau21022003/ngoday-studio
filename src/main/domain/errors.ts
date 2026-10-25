import type { DomainErrorCode, DomainErrorPayload } from "../../shared/domain"

export class DomainError extends Error {
  readonly code: DomainErrorCode
  readonly fieldErrors?: Record<string, string>
  readonly retryable: boolean

  constructor(
    code: DomainErrorCode,
    message: string,
    options: { fieldErrors?: Record<string, string>; retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = "DomainError"
    this.code = code
    this.fieldErrors = options.fieldErrors
    this.retryable = options.retryable ?? false
  }

  toPayload(): DomainErrorPayload {
    return {
      code: this.code,
      message: this.message,
      ...(this.fieldErrors ? { fieldErrors: this.fieldErrors } : {}),
      retryable: this.retryable,
    }
  }
}

export class StaleRevisionError extends DomainError {
  constructor(entity: string) {
    super("STALE_REVISION", `${entity} đã được thay đổi ở nơi khác. Hãy tải lại dữ liệu trước khi lưu.`)
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string) {
    super("NOT_FOUND", `Không tìm thấy ${entity}.`)
  }
}
