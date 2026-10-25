import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import type { TempFoundation } from "./helpers/temp-foundation"
import { createTempFoundation } from "./helpers/temp-foundation"
import { sceneJson, seedEpisode, seedSceneTemplate } from "./helpers/seed"

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 0, 0, 0, 0])
let context: TempFoundation

beforeEach(async () => { context = await createTempFoundation() })
afterEach(() => context.cleanup())

async function readySlot() {
  const template = seedSceneTemplate(context.foundation)
  const episode = seedEpisode(context.foundation)
  const rawJson = sceneJson()
  const preview = context.foundation.services.sceneCreation.validateImport({
    episodeId: episode.id,
    templateVersionId: template.versions[0]!.id,
    mode: "append",
    rawJson,
  })
  const imported = context.foundation.services.sceneCreation.commitImport({
    episodeId: episode.id,
    templateVersionId: template.versions[0]!.id,
    mode: "append",
    rawJson,
    payloadHash: preview.payloadHash,
    expectedEpisodeRevisionNo: episode.revisionNo,
  })
  context.foundation.services.scenes.transitionStatus({ id: imported.scenes[0]!.id, expectedRevisionNo: 1, status: "approved" })
  return { episode, slot: context.foundation.services.assetSlots.list(episode.id)[0]! }
}

describe("Asset filesystem boundary", () => {
  it("copies without changing the source, rejects duplicate bytes, and keeps binary on archive", async () => {
    const { slot } = await readySlot()
    const sourcePath = join(context.root, "external-source.png")
    writeFileSync(sourcePath, png)
    const candidate = await context.foundation.services.assets.importFile({
      assetSlotId: slot.id,
      expectedAssetSlotRevisionNo: slot.revisionNo,
    }, sourcePath)
    expect(readFileSync(sourcePath)).toEqual(png)
    const managedPath = join(context.workspace, candidate.relativePath!)
    expect(readFileSync(managedPath)).toEqual(png)
    expect(candidate).toMatchObject({ mimeType: "image/png", bytes: png.length, fileIntegrity: "available", promptSnapshot: slot.prompt })

    const currentSlot = context.foundation.services.assetSlots.list(slot.episodeId)[0]!
    await expect(context.foundation.services.assets.importFile({
      assetSlotId: slot.id,
      expectedAssetSlotRevisionNo: currentSlot.revisionNo,
    }, sourcePath)).rejects.toMatchObject({ code: "DUPLICATE_NAME" })
    expect(readdirSync(join(context.workspace, "assets", slot.episodeId, slot.id))).toHaveLength(1)

    context.foundation.services.assets.archive({ id: candidate.id, expectedRevisionNo: candidate.revisionNo })
    expect(existsSync(managedPath)).toBe(true)
    expect(readFileSync(sourcePath)).toEqual(png)
  })

  it("rejects empty, mismatched, and unsupported files without leaving partial copies", async () => {
    const { slot } = await readySlot()
    const empty = join(context.root, "empty.png")
    const video = join(context.root, "video.mp4")
    const fake = join(context.root, "fake.png")
    writeFileSync(empty, Buffer.alloc(0))
    writeFileSync(video, Buffer.from([0, 0, 0, 16, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0]))
    writeFileSync(fake, "not a png")

    await expect(context.foundation.services.assets.importFile({ assetSlotId: slot.id, expectedAssetSlotRevisionNo: slot.revisionNo }, empty))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" })
    await expect(context.foundation.services.assets.importFile({ assetSlotId: slot.id, expectedAssetSlotRevisionNo: slot.revisionNo }, video))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" })
    await expect(context.foundation.services.assets.importFile({ assetSlotId: slot.id, expectedAssetSlotRevisionNo: slot.revisionNo }, fake))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" })
    expect(existsSync(join(context.workspace, "assets"))).toBe(false)
  })

  it("atomically replaces the accepted candidate and preserves integrity lifecycle separation", async () => {
    const { episode, slot } = await readySlot()
    const firstSource = join(context.root, "first.png")
    const secondSource = join(context.root, "second.png")
    writeFileSync(firstSource, png)
    writeFileSync(secondSource, Buffer.concat([png, Buffer.from([1])]))
    const first = await context.foundation.services.assets.importFile({ assetSlotId: slot.id, expectedAssetSlotRevisionNo: slot.revisionNo }, firstSource)
    const afterFirst = context.foundation.services.assetSlots.list(episode.id)[0]!
    const second = await context.foundation.services.assets.importFile({ assetSlotId: slot.id, expectedAssetSlotRevisionNo: afterFirst.revisionNo }, secondSource)
    const acceptedFirst = context.foundation.services.assets.accept({ id: first.id, expectedRevisionNo: first.revisionNo })
    const acceptedSecond = context.foundation.services.assets.accept({ id: second.id, expectedRevisionNo: second.revisionNo })
    expect(acceptedSecond.status).toBe("accepted")
    expect(context.foundation.services.assets.get(acceptedFirst.id).status).toBe("rejected")

    writeFileSync(join(context.workspace, acceptedSecond.relativePath!), "changed")
    expect(context.foundation.services.assets.verifyIntegrity(acceptedSecond.id)).toMatchObject({ status: "accepted", fileIntegrity: "hash_mismatch" })
    expect(context.foundation.services.episodes.get(episode.id).workflowStatus).toBe("producing")
  })

  it("cleans the managed copy when the database revision changes during import", async () => {
    const { slot } = await readySlot()
    const sourcePath = join(context.root, "stale-during-copy.png")
    writeFileSync(sourcePath, Buffer.concat([png, Buffer.alloc(2 * 1024 * 1024)]))
    const importing = context.foundation.services.assets.importFile({
      assetSlotId: slot.id,
      expectedAssetSlotRevisionNo: slot.revisionNo,
    }, sourcePath)
    context.foundation.services.assetSlots.update({
      id: slot.id,
      expectedRevisionNo: slot.revisionNo,
      patch: { prompt: `${slot.prompt} updated concurrently` },
    })

    await expect(importing).rejects.toMatchObject({ code: "STALE_REVISION" })
    const slotDirectory = join(context.workspace, "assets", slot.episodeId, slot.id)
    expect(existsSync(slotDirectory) ? readdirSync(slotDirectory) : []).toHaveLength(0)
    expect(readFileSync(sourcePath).length).toBe(png.length + 2 * 1024 * 1024)
  })
})
