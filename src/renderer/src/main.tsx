import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { App } from "@/app"
import { requireStudioBridge } from "@/data/studio-client"
import "@/styles/globals.css"

requireStudioBridge(window.studio)

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
