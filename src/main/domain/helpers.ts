import { createHash, randomUUID } from "node:crypto"

export function newId() {
  return randomUUID()
}

export function nowUtc() {
  return new Date().toISOString()
}

export function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex")
}

export function normalizeKey(value: string) {
  return value.trim().normalize("NFC").toLocaleLowerCase("en-US")
}

export function slugify(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)

  return slug.length >= 3 ? slug : `episode-${randomUUID().slice(0, 8)}`
}

export function canonicalAssetName(canonicalNo: number, slotOrder: number) {
  return `scene-${String(canonicalNo).padStart(2, "0")}-${String(slotOrder).padStart(2, "0")}`
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}
