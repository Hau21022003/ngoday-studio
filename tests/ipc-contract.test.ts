import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { z } from "zod"

import {
  registerStudioIpc,
  registerValidatedHandler,
  type IpcRegistrar,
} from "../src/main/ipc/register-studio-ipc"
import { studioChannels } from "../src/shared/ipc"
import type { TempFoundation } from "./helpers/temp-foundation"
import { createTempFoundation } from "./helpers/temp-foundation"

class FakeRegistrar implements IpcRegistrar {
  readonly handlers = new Map<string, (event: unknown, input: unknown) => unknown>()

  handle(channel: string, listener: (event: unknown, input: unknown) => unknown) {
    this.handlers.set(channel, listener)
  }

  async invoke(channel: string, input: unknown) {
    const handler = this.handlers.get(channel)
    if (!handler) throw new Error(`Missing handler ${channel}`)
    return handler({}, input)
  }
}

let testContext: TempFoundation
let registrar: FakeRegistrar

beforeEach(async () => {
  testContext = await createTempFoundation()
  registrar = new FakeRegistrar()
  registerStudioIpc(registrar, testContext.foundation)
})

afterEach(() => testContext.cleanup())

describe("typed IPC boundary", () => {
  it("registers explicit use-case channels and rejects invalid input", async () => {
    expect(registrar.handlers.has(studioChannels.episodesCreate)).toBe(true)
    expect([...registrar.handlers.keys()].some((channel) => channel.includes("execute-sql"))).toBe(false)
    await expect(
      registrar.invoke(studioChannels.episodesCreate, {
        title: "x",
        topic: "unknown",
        description: "short",
        createdByName: "Test",
        extra: true,
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR", retryable: false } })
  })

  it("returns a validated response envelope for valid commands", async () => {
    const result = await registrar.invoke(studioChannels.episodesCreate, {
      title: "Episode qua IPC",
      topic: "science",
      description: "Mô tả Episode hợp lệ được tạo qua typed IPC.",
      createdByName: "Test",
    })
    expect(result).toMatchObject({
      ok: true,
      data: { title: "Episode qua IPC", topic: "science", revisionNo: 1, archivedAt: null },
    })
  })

  it("fails closed when a handler returns a response outside its schema", async () => {
    const isolated = new FakeRegistrar()
    registerValidatedHandler(isolated, "test:response", z.object({ value: z.string() }), z.object({ id: z.string().uuid() }), () => ({ id: "not-a-uuid" }))
    await expect(isolated.invoke("test:response", { value: "ok" })).resolves.toEqual({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Response nội bộ không đúng contract.", retryable: false },
    })
  })
})
