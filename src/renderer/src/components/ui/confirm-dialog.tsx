import * as DialogPrimitive from "@radix-ui/react-dialog"
import { TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  cancelLabel = "Ở lại",
  confirmLabel = "Rời đi",
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  cancelLabel?: string
  confirmLabel?: string
  onConfirm: () => void
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-primary/28 backdrop-blur-[1px] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out data-[state=open]:fade-in motion-reduce:animate-none" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[81] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overscroll-contain rounded-lg border border-border bg-surface p-5 shadow-overlay focus:outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out data-[state=open]:fade-in data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 motion-reduce:animate-none">
          <div className="flex items-start gap-4">
            <div className="grid size-11 shrink-0 place-items-center rounded-md bg-accent-soft text-accent-strong">
              <TriangleAlert aria-hidden="true" className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="text-sm font-bold text-primary text-balance">
                {title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1.5 text-xs leading-5 text-muted-foreground text-pretty">
                {description}
              </DialogPrimitive.Description>
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2.5">
            <DialogPrimitive.Close asChild>
              <Button type="button" variant="outline">
                {cancelLabel}
              </Button>
            </DialogPrimitive.Close>
            <Button type="button" variant="accent" onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export { ConfirmDialog }
