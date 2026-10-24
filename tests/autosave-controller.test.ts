import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SingleFlightAutosave, type AutosaveState } from "../src/renderer/src/hooks/use-single-flight-autosave"

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe("Episode notes single-flight autosave", () => {
  it("debounces edits and saves only the newest draft", async () => {
    const save = vi.fn(async () => ({ revisionNo: 2 }))
    const states: AutosaveState[] = []
    const controller = new SingleFlightAutosave(1, 750, save, (state) => states.push(state))

    controller.schedule("bản nháp 1")
    await vi.advanceTimersByTimeAsync(500)
    controller.schedule("bản nháp mới nhất")
    await vi.advanceTimersByTimeAsync(749)
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith("bản nháp mới nhất", 1)
    expect(states.at(-1)).toEqual({ status: "saved", error: null, dirty: false })
    controller.dispose()
  })

  it("keeps one request in flight, coalesces pending text, and chains revisions", async () => {
    let resolveFirst!: (result: { revisionNo: number }) => void
    const first = new Promise<{ revisionNo: number }>((resolve) => { resolveFirst = resolve })
    const save = vi.fn()
      .mockImplementationOnce(() => first)
      .mockResolvedValueOnce({ revisionNo: 3 })
    const controller = new SingleFlightAutosave(1, 750, save, () => undefined)

    controller.schedule("đầu tiên")
    await vi.advanceTimersByTimeAsync(750)
    expect(save).toHaveBeenCalledWith("đầu tiên", 1)

    controller.schedule("trung gian")
    controller.schedule("mới nhất")
    await vi.advanceTimersByTimeAsync(750)
    expect(save).toHaveBeenCalledTimes(1)

    resolveFirst({ revisionNo: 2 })
    await vi.runAllTimersAsync()
    await Promise.resolve()

    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith("mới nhất", 2)
    controller.dispose()
  })

  it("retains the latest draft and pauses after a stale revision until explicitly rebased", async () => {
    const conflict = Object.assign(new Error("stale"), { code: "STALE_REVISION" })
    const states: AutosaveState[] = []
    const save = vi.fn()
      .mockRejectedValueOnce(conflict)
      .mockResolvedValueOnce({ revisionNo: 8 })
    const controller = new SingleFlightAutosave(6, 750, save, (state) => states.push(state))

    controller.schedule("bản nháp cần giữ")
    await vi.advanceTimersByTimeAsync(750)
    expect(states.at(-1)).toEqual({ status: "conflict", error: conflict, dirty: true })

    controller.schedule("bản nháp mới hơn")
    await vi.advanceTimersByTimeAsync(2_000)
    expect(save).toHaveBeenCalledTimes(1)

    controller.updateRevision(7)
    await controller.retry()
    expect(save).toHaveBeenLastCalledWith("bản nháp mới hơn", 7)
    expect(states.at(-1)).toEqual({ status: "saved", error: null, dirty: false })
    controller.dispose()
  })
})
