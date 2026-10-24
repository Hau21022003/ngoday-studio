import { DomainError } from "../domain/errors"

export function rethrowSqliteConstraint(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes("UNIQUE constraint failed")) {
    throw new DomainError("DUPLICATE_NAME", "Dữ liệu bị trùng với một record hiện có.", { cause: error })
  }
  if (message.includes("FOREIGN KEY constraint failed") || message.includes("CHECK constraint failed")) {
    throw new DomainError("VALIDATION_ERROR", "Dữ liệu vi phạm ràng buộc persistence.", { cause: error })
  }
  throw error
}
