import { DatabaseBackup, Download, ShieldCheck, Upload } from "lucide-react"
import { useState } from "react"

import type { MetadataBackupResult } from "../../../shared/domain"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { PageHeader } from "@/components/ui/page-header"
import { errorMessage, unwrapResult } from "@/data/studio-client"
import { cn } from "@/lib/utils"

function resultText(action: "export" | "restore", result: MetadataBackupResult) {
  if (result.cancelled) return action === "export" ? "Đã hủy xuất backup." : "Đã hủy restore; dữ liệu không thay đổi."
  const counts = result.summary
    ? `${result.summary.templates} Template, ${result.summary.episodes} Episode, ${result.summary.scenes} Scene, ${result.summary.assetSlots} AssetSlot và ${result.summary.assets} Asset.`
    : ""
  return action === "export"
    ? `Đã xuất ${result.fileName}. ${counts}`
    : `Đã restore ${result.fileName}. ${counts}`
}

function SettingsPage() {
  const [busy, setBusy] = useState(false)
  const [restoreOpen, setRestoreOpen] = useState(false)
  const [notice, setNotice] = useState("")
  const [failure, setFailure] = useState("")

  async function exportBackup() {
    setBusy(true); setFailure(""); setNotice("")
    try {
      const result = await unwrapResult(window.studio.metadataBackup.export())
      setNotice(resultText("export", result))
    } catch (error) { setFailure(errorMessage(error, "Không thể xuất metadata backup.")) }
    finally { setBusy(false) }
  }

  async function restoreBackup() {
    setRestoreOpen(false); setBusy(true); setFailure(""); setNotice("")
    try {
      const result = await unwrapResult(window.studio.metadataBackup.restore())
      setNotice(resultText("restore", result))
    } catch (error) { setFailure(errorMessage(error, "Không thể restore metadata backup.")) }
    finally { setBusy(false) }
  }

  return (
    <>
      <div className="min-h-screen px-5 py-6 sm:px-7 lg:px-8 lg:py-7">
        <PageHeader title="Settings" description="Backup và phục hồi metadata local của Phase 1." />
        <section className="mt-6 max-w-4xl rounded-lg border border-border bg-surface p-5 shadow-panel" aria-labelledby="metadata-backup-title">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-md bg-info-soft text-info"><DatabaseBackup aria-hidden="true" className="size-5" /></span>
            <div><h2 id="metadata-backup-title" className="text-base font-bold text-primary">Metadata backup v1</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Backup gồm Template, Episode, Scenes, narration, AssetSlot và metadata Asset. <strong className="text-primary">Backup không chứa binary ảnh/video</strong>, browser profile, credential hoặc Nội dung nguồn tạm.</p></div>
          </div>
          <div className="mt-4 rounded-lg border border-warning/20 bg-warning-soft p-3 text-xs leading-5 text-warning">
            Restore chỉ được phép khi database business trống. Ứng dụng không merge, overwrite, reset hoặc xóa dữ liệu hiện tại. Relative path được giữ; binary không có trong workspace sẽ hiện trạng thái missing.
          </div>
          {(notice || failure) && <div role={failure ? "alert" : "status"} className={cn("mt-4 rounded-md px-3 py-2 text-xs", failure ? "bg-danger-soft text-danger" : "bg-success-soft text-success")}>{failure || notice}</div>}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-4"><Download aria-hidden="true" className="size-5 text-accent" /><h3 className="mt-3 text-sm font-bold text-primary">Xuất metadata</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Tạo JSON strict có checksum. File binary vẫn nằm nguyên trong workspace.</p><Button type="button" variant="accent" className="mt-4" disabled={busy} onClick={() => void exportBackup()}><Download aria-hidden="true" />Xuất backup</Button></div>
            <div className="rounded-lg border border-border p-4"><Upload aria-hidden="true" className="size-5 text-accent" /><h3 className="mt-3 text-sm font-bold text-primary">Restore metadata</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Strict validation và transaction toàn bộ; lỗi sẽ rollback, không ghi dữ liệu nửa chừng.</p><Button type="button" variant="outline" className="mt-4" disabled={busy} onClick={() => setRestoreOpen(true)}><ShieldCheck aria-hidden="true" />Chọn file restore</Button></div>
          </div>
        </section>
      </div>
      <ConfirmDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        title="Xác nhận restore metadata?"
        description="Restore chỉ chạy nếu database business đang trống. Thao tác không chứa hoặc khôi phục binary ảnh/video, không overwrite/reset dữ liệu hiện có. Sau xác nhận bạn vẫn có thể hủy native file picker."
        cancelLabel="Hủy"
        confirmLabel="Tiếp tục chọn file"
        onConfirm={() => void restoreBackup()}
      />
    </>
  )
}

export { SettingsPage }
