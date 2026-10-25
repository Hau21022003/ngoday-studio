import migration0001 from "./migrations/0001_phase1_core.sql?raw"

export type Migration = {
  version: number
  name: string
  sql: string
}

export const migrations: readonly Migration[] = [
  {
    version: 1,
    name: "phase1_core",
    sql: migration0001,
  },
]
