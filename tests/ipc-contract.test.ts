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
import { seedSceneTemplate } from "./helpers/seed"

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
    expect(registrar.handlers.has(studioChannels.templatesSaveEdit)).toBe(true)
    expect(registrar.handlers.has(studioChannels.episodeThumbnailsImport)).toBe(true)
    expect(registrar.handlers.has(studioChannels.episodeThumbnailsRead)).toBe(true)
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

  it("exposes atomic Template edit and restricted thumbnail use cases", async () => {
    const template = seedSceneTemplate(testContext.foundation)
    const currentVersion = template.versions[0]!
    const edited = await registrar.invoke(studioChannels.templatesSaveEdit, {
      id: template.id,
      expectedRevisionNo: template.revisionNo,
      patch: { description: "Template đã được cập nhật nguyên tử qua typed IPC." },
      version: {
        content: currentVersion.content,
        variables: currentVersion.variables,
        changeNote: "Tạo immutable version qua IPC.",
        createdByName: "Test",
      },
    })
    expect(edited).toMatchObject({
      ok: true,
      data: { revisionNo: 2, versions: [{ minor: 1 }, { minor: 0 }] },
    })

    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])
    const imported = await registrar.invoke(studioChannels.episodeThumbnailsImport, {
      fileName: "ipc.png",
      mimeType: "image/png",
      dataBase64: png.toString("base64"),
    }) as { ok: true; data: { relativePath: string } }
    expect(imported).toMatchObject({ ok: true, data: { mimeType: "image/png" } })
    await expect(registrar.invoke(studioChannels.episodeThumbnailsRead, {
      relativePath: imported.data.relativePath,
    })).resolves.toMatchObject({ ok: true, data: { dataUrl: expect.stringMatching(/^data:image\/png;base64,/) } })
    await expect(registrar.invoke(studioChannels.episodeThumbnailsRead, {
      relativePath: "../outside.png",
    })).resolves.toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } })
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

  it("maps optimistic concurrency conflicts to a typed IPC error without overwriting data", async () => {
    const created = await registrar.invoke(studioChannels.episodesCreate, {
      title: "Episode conflict IPC",
      topic: "science",
      description: "Mô tả hợp lệ để kiểm tra optimistic concurrency qua IPC.",
      createdByName: "Test",
    }) as { ok: true; data: { id: string } }
    const first = await registrar.invoke(studioChannels.episodesUpdate, {
      id: created.data.id,
      expectedRevisionNo: 1,
      updatedByName: "Test",
      patch: { notes: "Bản ghi đã lưu" },
    })
    expect(first).toMatchObject({ ok: true, data: { notes: "Bản ghi đã lưu", revisionNo: 2 } })

    await expect(registrar.invoke(studioChannels.episodesUpdate, {
      id: created.data.id,
      expectedRevisionNo: 1,
      updatedByName: "Test",
      patch: { notes: "Bản stale không được ghi đè" },
    })).resolves.toMatchObject({ ok: false, error: { code: "STALE_REVISION", retryable: false } })
    await expect(registrar.invoke(studioChannels.episodesGet, { id: created.data.id }))
      .resolves.toMatchObject({ ok: true, data: { notes: "Bản ghi đã lưu", revisionNo: 2 } })
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
