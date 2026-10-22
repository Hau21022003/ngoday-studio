import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from 'lucide-react';
import type { AssetSlot, CharacterReference, Scene } from '../../../shared/domain.js';
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
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Field, FieldLabel } from './ui/field';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

type SceneWithSlots = Scene & { assetSlots: AssetSlot[] };

interface Props {
  scene: SceneWithSlots;
  references: CharacterReference[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove(direction: -1 | 1): void;
  onRefresh(): Promise<void>;
  onError(error: unknown): void;
}

const statusTone: Record<Scene['status'], string> = {
  draft: 'border-border bg-muted text-muted-foreground',
  in_review: 'border-[#e8c58f] bg-[#fff4df] text-[#8b5a12]',
  approved: 'border-[#b7d4c3] bg-[#e8f4ec] text-[#275f48]',
  needs_changes: 'border-[#e5b6aa] bg-[#fff0eb] text-[#963d29]',
};

export function SceneCard({
  scene,
  references,
  canMoveUp,
  canMoveDown,
  onMove,
  onRefresh,
  onError,
}: Props) {
  const [draft, setDraft] = useState(scene);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<'saved' | 'waiting' | 'saving'>('saved');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraft(scene);
    setDirty(false);
    setSaveState('saved');
  }, [scene]);

  useEffect(() => {
    if (!dirty) return;
    setSaveState('waiting');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setSaveState('saving');
      void window.studio.scenes
        .update({
          id: draft.id,
          revisionNo: draft.revisionNo,
          title: draft.title,
          summary: draft.summary,
          narration: draft.narration,
          imagePrompt: draft.imagePrompt,
          videoPrompt: draft.videoPrompt,
        })
        .then((saved) => {
          setDraft((current) => ({ ...current, ...saved, assetSlots: current.assetSlots }));
          setDirty(false);
          setSaveState('saved');
        })
        .catch((error) => {
          setSaveState('waiting');
          onError(error);
        });
    }, 700);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [
    dirty,
    draft.id,
    draft.imagePrompt,
    draft.narration,
    draft.revisionNo,
    draft.summary,
    draft.title,
    draft.videoPrompt,
    onError,
  ]);

  function update(
    field: 'title' | 'summary' | 'narration' | 'imagePrompt' | 'videoPrompt',
    value: string,
  ) {
    setDraft((current) => ({ ...current, [field]: value }));
    setDirty(true);
  }

  async function approve() {
    if (dirty || saveState === 'saving') {
      onError(new Error('Hãy chờ autosave hoàn tất trước khi duyệt scene.'));
      return;
    }
    try {
      await window.studio.scenes.approve(scene.id);
      await onRefresh();
    } catch (error) {
      onError(error);
    }
  }

  async function remove() {
    try {
      await window.studio.scenes.delete(scene.id);
      await onRefresh();
    } catch (error) {
      onError(error);
    }
  }

  async function addAsset() {
    try {
      await window.studio.assets.create({
        sceneId: scene.id,
        mediaType: 'image',
        required: true,
        prompt: draft.imagePrompt,
      });
      await onRefresh();
    } catch (error) {
      onError(error);
    }
  }

  const saveLabel =
    saveState === 'saved' ? 'Đã lưu' : saveState === 'saving' ? 'Đang lưu…' : 'Chờ autosave';

  return (
    <article className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <header className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 border-b bg-muted/70 p-3">
        <div className="grid size-11 place-items-center rounded-lg bg-secondary font-serif text-base text-secondary-foreground">
          {String(scene.sceneOrder).padStart(2, '0')}
        </div>
        <div className="min-w-0">
          <Input
            aria-label={`Tiêu đề Scene ${scene.sceneOrder}`}
            placeholder="Tên scene"
            value={draft.title}
            disabled={saveState === 'saving'}
            className="h-8 border-transparent bg-transparent px-2 text-base font-semibold shadow-none focus-visible:bg-background"
            onChange={(event) => update('title', event.target.value)}
          />
          <div className="mt-1 flex flex-wrap items-center gap-2 px-2">
            <Badge variant="outline" className={statusTone[draft.status]}>
              {draft.status}
            </Badge>
            <span
              className={
                saveState === 'saving'
                  ? 'text-[11px] text-primary'
                  : 'text-[11px] text-muted-foreground'
              }
              aria-live="polite"
            >
              {saveLabel}
            </span>
          </div>
        </div>
        <div className="flex gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={!canMoveUp}
                aria-label="Di chuyển scene lên"
                onClick={() => onMove(-1)}
              >
                <ArrowUp aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Di chuyển lên</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={!canMoveDown}
                aria-label="Di chuyển scene xuống"
                onClick={() => onMove(1)}
              >
                <ArrowDown aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Di chuyển xuống</TooltipContent>
          </Tooltip>
          <AlertDialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Xóa scene">
                    <Trash2 aria-hidden="true" />
                  </Button>
                </AlertDialogTrigger>
              </TooltipTrigger>
              <TooltipContent>Xóa scene</TooltipContent>
            </Tooltip>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Xóa Scene {scene.sceneOrder}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Các asset slot bên trong scene cũng sẽ bị xóa. Thao tác này không thể hoàn tác.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Hủy</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => void remove()}>
                  Xóa scene
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      <div className="grid gap-3 p-4 xl:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`scene-${scene.id}-summary`}>Tóm tắt</FieldLabel>
          <Textarea
            id={`scene-${scene.id}-summary`}
            rows={2}
            value={draft.summary}
            disabled={saveState === 'saving'}
            onChange={(event) => update('summary', event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`scene-${scene.id}-narration`}>Narration</FieldLabel>
          <Textarea
            id={`scene-${scene.id}-narration`}
            rows={3}
            value={draft.narration}
            disabled={saveState === 'saving'}
            onChange={(event) => update('narration', event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`scene-${scene.id}-image-prompt`}>Image prompt</FieldLabel>
          <Textarea
            id={`scene-${scene.id}-image-prompt`}
            rows={3}
            value={draft.imagePrompt}
            disabled={saveState === 'saving'}
            onChange={(event) => update('imagePrompt', event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`scene-${scene.id}-video-prompt`}>Video prompt</FieldLabel>
          <Textarea
            id={`scene-${scene.id}-video-prompt`}
            rows={3}
            value={draft.videoPrompt}
            disabled={saveState === 'saving'}
            onChange={(event) => update('videoPrompt', event.target.value)}
          />
        </Field>
      </div>

      <section className="border-t px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <strong className="text-sm">Asset slots</strong>
          <Button type="button" variant="ghost" size="sm" onClick={addAsset}>
            <Plus aria-hidden="true" /> Asset
          </Button>
        </div>
        <div className="grid gap-2">
          {scene.assetSlots.map((slot) => (
            <AssetSlotEditor
              key={slot.id}
              slot={slot}
              references={references}
              onRefresh={onRefresh}
              onError={onError}
            />
          ))}
          {!scene.assetSlots.length && (
            <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              Cần ít nhất một asset slot trước khi approve.
            </p>
          )}
        </div>
      </section>

      <footer className="flex justify-end border-t bg-muted/35 px-4 py-3">
        <Button type="button" onClick={approve} disabled={saveState !== 'saved'}>
          <Check aria-hidden="true" /> Duyệt scene
        </Button>
      </footer>
    </article>
  );
}

function AssetSlotEditor({
  slot,
  references,
  onRefresh,
  onError,
}: {
  slot: AssetSlot;
  references: CharacterReference[];
  onRefresh(): Promise<void>;
  onError(error: unknown): void;
}) {
  const [draft, setDraft] = useState(slot);

  useEffect(() => setDraft(slot), [slot]);

  async function save() {
    try {
      await window.studio.assets.update({
        id: draft.id,
        mediaType: draft.mediaType,
        required: draft.required,
        prompt: draft.prompt,
        referenceIds: draft.referenceIds,
      });
      await onRefresh();
    } catch (error) {
      onError(error);
    }
  }

  async function remove() {
    try {
      await window.studio.assets.delete(slot.id);
      await onRefresh();
    } catch (error) {
      onError(error);
    }
  }

  return (
    <div className="grid gap-2 rounded-lg border bg-muted/35 p-3 xl:grid-cols-[8.5rem_7rem_minmax(12rem,1fr)_auto] xl:items-start">
      <div className="grid gap-2">
        <code className="truncate text-[11px] font-semibold text-accent-foreground">
          {slot.canonicalName}
        </code>
        <label
          className="flex items-center gap-2 text-xs font-medium"
          htmlFor={`${slot.id}-required`}
        >
          <Checkbox
            id={`${slot.id}-required`}
            checked={draft.required}
            onCheckedChange={(checked) => setDraft({ ...draft, required: checked === true })}
          />
          bắt buộc
        </label>
      </div>

      <Select
        value={draft.mediaType}
        onValueChange={(value) => setDraft({ ...draft, mediaType: value as 'image' | 'video' })}
      >
        <SelectTrigger aria-label={`Loại media ${slot.canonicalName}`} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="image">Image</SelectItem>
          <SelectItem value="video">Video</SelectItem>
        </SelectContent>
      </Select>

      <Textarea
        aria-label={`Prompt ${slot.canonicalName}`}
        rows={2}
        placeholder="Generation prompt…"
        value={draft.prompt}
        onChange={(event) => setDraft({ ...draft, prompt: event.target.value })}
      />

      <div className="flex justify-end gap-1">
        <Button type="button" variant="secondary" size="sm" onClick={save}>
          Lưu slot
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Xóa ${slot.canonicalName}`}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Xóa {slot.canonicalName}?</AlertDialogTitle>
              <AlertDialogDescription>
                Asset slot sẽ bị xóa khỏi scene hiện tại.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={() => void remove()}>
                Xóa slot
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {references.length > 0 && (
        <fieldset className="col-span-full flex flex-wrap gap-x-4 gap-y-2 border-t pt-2">
          <legend className="mb-1 text-xs font-medium text-muted-foreground">References</legend>
          {references.map((reference) => (
            <label key={reference.id} className="flex items-center gap-2 text-xs font-medium">
              <Checkbox
                checked={draft.referenceIds.includes(reference.id)}
                onCheckedChange={(checked) =>
                  setDraft({
                    ...draft,
                    referenceIds:
                      checked === true
                        ? [...draft.referenceIds, reference.id]
                        : draft.referenceIds.filter((id) => id !== reference.id),
                  })
                }
              />
              {reference.name}
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}
