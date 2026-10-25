import type { DomainErrorPayload, IpcResult } from "../../../shared/domain"
import type { StudioBridge } from "../../../shared/ipc"

function requireStudioBridge(value: unknown): StudioBridge {
  const candidate = value as Partial<StudioBridge> | null | undefined
  if (
    !candidate
    || typeof candidate.templates?.list !== "function"
    || typeof candidate.templates?.saveEdit !== "function"
    || typeof candidate.episodes?.list !== "function"
    || typeof candidate.episodes?.update !== "function"
    || typeof candidate.episodeThumbnails?.import !== "function"
    || typeof candidate.episodeThumbnails?.read !== "function"
    || typeof candidate.sceneCreation?.renderPrompt !== "function"
    || typeof candidate.sceneCreation?.validateImport !== "function"
    || typeof candidate.sceneCreation?.commitImport !== "function"
    || typeof candidate.scenes?.get !== "function"
    || typeof candidate.scenes?.update !== "function"
    || typeof candidate.scenes?.reorder !== "function"
    || typeof candidate.scenes?.transitionStatus !== "function"
    || typeof candidate.assetSlots?.list !== "function"
    || typeof candidate.assetSlots?.create !== "function"
    || typeof candidate.assetSlots?.update !== "function"
    || typeof candidate.assets?.list !== "function"
    || typeof candidate.assets?.importFile !== "function"
    || typeof candidate.assets?.verifyIntegrity !== "function"
    || typeof candidate.assets?.accept !== "function"
    || typeof candidate.assets?.reject !== "function"
    || typeof candidate.assets?.archive !== "function"
    || typeof candidate.metadataBackup?.export !== "function"
    || typeof candidate.metadataBackup?.restore !== "function"
  ) {
    throw new Error("Studio preload bridge không khả dụng. Ứng dụng không thể truy cập persistence an toàn.")
  }
  return candidate as StudioBridge
}

class StudioClientError extends Error {
  readonly code: DomainErrorPayload["code"]
  readonly fieldErrors?: Record<string, string>
  readonly retryable: boolean

  constructor(payload: DomainErrorPayload) {
    super(payload.message)
    this.name = "StudioClientError"
    this.code = payload.code
    this.fieldErrors = payload.fieldErrors
    this.retryable = payload.retryable
  }
}

async function unwrapResult<T>(promise: Promise<IpcResult<T>>): Promise<T> {
  const result = await promise
  if (!result.ok) throw new StudioClientError(result.error)
  return result.data
}

function errorMessage(error: unknown, fallback = "Đã xảy ra lỗi không mong đợi.") {
  return error instanceof Error && error.message ? error.message : fallback
}

const localActorName = "Bạn"

export { StudioClientError, errorMessage, localActorName, requireStudioBridge, unwrapResult }
