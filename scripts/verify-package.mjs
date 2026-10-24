import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, join, resolve, sep } from "node:path"
import { spawn } from "node:child_process"
import { DatabaseSync } from "node:sqlite"

const executable = resolve("release", "win-unpacked", "Ngộ Dậy Studio.exe")
const smokeRoot = mkdtempSync(join(tmpdir(), "ngoday-package-smoke-"))

function runPackagedSmoke(phase) {
  return new Promise((resolveRun, rejectRun) => {
    const childEnvironment = { ...process.env }
    delete childEnvironment.ELECTRON_RUN_AS_NODE
    const child = spawn(executable, [`--user-data-dir=${join(smokeRoot, "electron-user-data")}`], {
      env: {
        ...childEnvironment,
        NGODAY_PERSISTENCE_SMOKE: "1",
        NGODAY_PERSISTENCE_SMOKE_PHASE: phase,
        NGODAY_PERSISTENCE_SMOKE_ROOT: smokeRoot,
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk)
    })
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk)
    })
    const timeout = setTimeout(() => {
      child.kill()
      rejectRun(new Error("Packaged persistence smoke timed out."))
    }, 20_000)
    child.once("error", (error) => {
      clearTimeout(timeout)
      rejectRun(error)
    })
    child.once("exit", (code) => {
      clearTimeout(timeout)
      if (code === 0) resolveRun({ stdout, stderr })
      else {
        const errorMarker = join(smokeRoot, "persistence-smoke-error.txt")
        const markerDetails = existsSync(errorMarker) ? readFileSync(errorMarker, "utf8") : ""
        rejectRun(new Error(`Packaged app phase ${phase} exited with ${code}: ${markerDetails || stderr || stdout}`))
      }
    })
  })
}

async function waitForSmokeMarker(phase, timeoutMs = 10_000) {
  const successMarker = join(smokeRoot, `persistence-smoke-${phase}.json`)
  const errorMarker = join(smokeRoot, "persistence-smoke-error.txt")
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (existsSync(errorMarker)) throw new Error(readFileSync(errorMarker, "utf8"))
    if (existsSync(successMarker)) return successMarker
    await new Promise((resolveWait) => setTimeout(resolveWait, 100))
  }
  throw new Error("Packaged app exited without persistence smoke marker.")
}

try {
  for (const phase of ["write", "read", "bridge-write", "bridge-read"]) {
    const processOutput = await runPackagedSmoke(phase)
    try {
      await waitForSmokeMarker(phase)
    } catch (error) {
      const details = [processOutput.stdout, processOutput.stderr].filter(Boolean).join("\n")
      throw new Error(`${error instanceof Error ? error.message : String(error)}${details ? `\n${details}` : ""}`)
    }
  }
  const databasePath = join(smokeRoot, "data", "ngoday-studio.sqlite3")
  const database = new DatabaseSync(databasePath, { readOnly: true })
  try {
    const migration = database.prepare("SELECT version, name FROM schema_migrations ORDER BY version DESC LIMIT 1").get()
    const integrity = database.prepare("PRAGMA integrity_check").get()
    if (migration?.version !== 1 || migration?.name !== "phase1_core" || integrity?.integrity_check !== "ok") {
      throw new Error("Packaged database did not pass migration/integrity verification.")
    }
  } finally {
    database.close()
  }
  process.stdout.write("Packaged Electron persistence smoke passed.\n")
} finally {
  const resolvedRoot = resolve(smokeRoot)
  const resolvedTemp = `${resolve(tmpdir())}${sep}`
  if (!resolvedRoot.startsWith(resolvedTemp) || !basename(resolvedRoot).startsWith("ngoday-package-smoke-")) {
    throw new Error("Refusing to remove an unexpected smoke directory.")
  }
  rmSync(resolvedRoot, { recursive: true, force: true })
}
