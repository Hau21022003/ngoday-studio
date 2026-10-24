import type { StudioBridge } from "../../shared/ipc"

declare global {
  interface Window {
    studio: StudioBridge
  }
}

export {}
