import { useEffect, useRef, useState } from "react"

type AutosaveStatus = "idle" | "dirty" | "saving" | "saved" | "error" | "conflict"

type AutosaveState = {
  status: AutosaveStatus
  error: unknown
  dirty: boolean
}

type SaveResult = { revisionNo: number }

class SingleFlightAutosave<T> {
  private revisionNo: number
  private pending: T | undefined
  private activeFlush: Promise<boolean> | null = null
  private blockedByConflict = false
  private timer: ReturnType<typeof setTimeout> | undefined
  private disposed = false

  constructor(
    revisionNo: number,
    private readonly delayMs: number,
    private readonly save: (value: T, expectedRevisionNo: number) => Promise<SaveResult>,
    private readonly onState: (state: AutosaveState) => void,
  ) {
    this.revisionNo = revisionNo
  }

  schedule(value: T) {
    if (this.disposed) return
    this.pending = value
    this.clearTimer()
    this.onState({ status: "dirty", error: null, dirty: true })
    if (!this.blockedByConflict) this.timer = setTimeout(() => void this.flush(), this.delayMs)
  }

  flush(): Promise<boolean> {
    if (this.activeFlush) return this.activeFlush
    if (this.disposed) return Promise.resolve(false)
    if (this.blockedByConflict) return Promise.resolve(false)
    if (this.pending === undefined) return Promise.resolve(true)
    this.activeFlush = this.flushPending().finally(() => {
      this.activeFlush = null
    })
    return this.activeFlush
  }

  private async flushPending(): Promise<boolean> {
    if (this.disposed || this.blockedByConflict) return false
    if (this.pending === undefined) return true
    this.clearTimer()
    const value = this.pending
    this.pending = undefined
    this.onState({ status: "saving", error: null, dirty: true })
    let succeeded = false
    try {
      const result = await this.save(value, this.revisionNo)
      this.revisionNo = result.revisionNo
      succeeded = true
      if (this.pending === undefined) this.onState({ status: "saved", error: null, dirty: false })
    } catch (error) {
      if (this.pending === undefined) this.pending = value
      const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined
      this.blockedByConflict = code === "STALE_REVISION"
      this.onState({ status: code === "STALE_REVISION" ? "conflict" : "error", error, dirty: true })
      return false
    }
    if (succeeded && this.pending !== undefined) return this.flushPending()
    return succeeded
  }

  retry() {
    return this.flush()
  }

  updateRevision(revisionNo: number) {
    this.revisionNo = revisionNo
    this.blockedByConflict = false
  }

  activate() {
    this.disposed = false
  }

  dispose() {
    this.disposed = true
    this.clearTimer()
  }

  private clearTimer() {
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = undefined
  }
}

function useSingleFlightAutosave<T>({
  initialRevisionNo,
  delayMs = 750,
  save,
}: {
  initialRevisionNo: number
  delayMs?: number
  save: (value: T, expectedRevisionNo: number) => Promise<SaveResult>
}) {
  const saveRef = useRef(save)
  saveRef.current = save
  const [state, setState] = useState<AutosaveState>({ status: "idle", error: null, dirty: false })
  const controllerRef = useRef<SingleFlightAutosave<T> | null>(null)
  if (!controllerRef.current) {
    controllerRef.current = new SingleFlightAutosave(
      initialRevisionNo,
      delayMs,
      (value, revisionNo) => saveRef.current(value, revisionNo),
      setState,
    )
  }

  useEffect(() => {
    controllerRef.current?.updateRevision(initialRevisionNo)
  }, [initialRevisionNo])

  useEffect(() => {
    controllerRef.current?.activate()
    return () => controllerRef.current?.dispose()
  }, [])

  return {
    ...state,
    schedule: (value: T) => controllerRef.current?.schedule(value),
    flush: () => controllerRef.current?.flush(),
    retry: () => controllerRef.current?.retry(),
    updateRevision: (revisionNo: number) => controllerRef.current?.updateRevision(revisionNo),
  }
}

export { SingleFlightAutosave, useSingleFlightAutosave }
export type { AutosaveState, AutosaveStatus }
