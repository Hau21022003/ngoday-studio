import { useState } from 'react';
import { CheckCircle2, DatabaseBackup, HardDriveDownload, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

export function BackupWorkspace({
  onRefresh,
  onError,
}: {
  onRefresh(): Promise<void>;
  onError(error: unknown): void;
}) {
  const [message, setMessage] = useState('');

  async function exportBackup() {
    try {
      const result = await window.studio.backup.export();
      if (result.completed) setMessage(`Đã tạo backup: ${result.path}`);
    } catch (error) {
      onError(error);
    }
  }

  async function restoreBackup() {
    try {
      const result = await window.studio.backup.restore();
      if (result.completed) {
        setMessage(`Đã restore: ${result.path}`);
        await onRefresh();
      }
    } catch (error) {
      onError(error);
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-4">
      <header className="px-1 py-1">
        <p className="eyebrow">LOCAL DATA SAFETY</p>
        <h2 className="font-serif text-3xl font-semibold tracking-tight">Backup & Restore</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Snapshot metadata versioned, không chứa credential, browser profile hoặc binary reference.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="relative overflow-hidden bg-card/95 shadow-sm">
          <span className="pointer-events-none absolute -right-1 -top-8 font-serif text-8xl text-secondary/5">
            01
          </span>
          <CardHeader className="pb-2">
            <HardDriveDownload className="mb-2 size-8 text-primary" aria-hidden="true" />
            <CardTitle>Export metadata</CardTitle>
            <CardDescription>
              Episode, template/version, script/revision, scene, asset slot và reference metadata.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={exportBackup}>Chọn nơi lưu backup</Button>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-card/95 shadow-sm">
          <span className="pointer-events-none absolute -right-1 -top-8 font-serif text-8xl text-secondary/5">
            02
          </span>
          <CardHeader className="pb-2">
            <DatabaseBackup className="mb-2 size-8 text-secondary" aria-hidden="true" />
            <CardTitle>Restore an toàn</CardTitle>
            <CardDescription>
              Validate toàn bộ file trước khi ghi. Database phải trống; lỗi sẽ rollback toàn bộ.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="secondary">Chọn file để restore</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Restore metadata vào database?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Restore chỉ chạy trên database trống và được thực hiện trong một transaction.
                    Bạn sẽ chọn file ở bước tiếp theo.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Hủy</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void restoreBackup()}>
                    Tiếp tục chọn file
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>

      {message && (
        <Alert className="border-[#b7d4c3] bg-[#eef8f1] text-[#275f48]" aria-live="polite">
          <CheckCircle2 aria-hidden="true" />
          <AlertDescription className="text-[#275f48]">{message}</AlertDescription>
        </Alert>
      )}

      <Card className="bg-card/80 shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" /> Không nằm trong
            backup
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid list-disc gap-x-8 gap-y-1 pl-5 text-sm text-muted-foreground md:grid-cols-2">
            <li>Google password, cookie hoặc token</li>
            <li>Browser profile và dữ liệu PoC</li>
            <li>Binary character reference</li>
            <li>Flow asset hoặc media generation</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
