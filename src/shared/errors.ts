export type DomainErrorCode =
  | 'CONFLICT'
  | 'DUPLICATE_SLUG'
  | 'IMPORT_INVALID'
  | 'NOT_FOUND'
  | 'REORDER_CONFIRMATION_REQUIRED'
  | 'RESTORE_REQUIRES_EMPTY_DATABASE'
  | 'SCENE_INVALID'
  | 'TEMPLATE_INVALID'
  | 'VALIDATION_ERROR';

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
    public readonly details: string[] = [],
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
