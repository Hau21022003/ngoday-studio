import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Archive,
  ChevronDown,
  Clipboard,
  FileInput,
  ImagePlus,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type {
  Episode,
  EpisodeDetail,
  ScriptRevision,
  TemplateDetail,
} from '../../../shared/domain.js';
import { episodeCreateSchema } from '../../../shared/schemas.js';
import { slugify } from '../../../shared/slug.js';
import { SceneCard } from './SceneCard';
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
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Field, FieldError, FieldLabel } from './ui/field';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Separator } from './ui/separator';
import { Textarea } from './ui/textarea';

interface Props {
  episodes: Episode[];
  selectedEpisodeId: string | null;
  detail: EpisodeDetail | null;
  templates: TemplateDetail[];
  query: string;
  includeArchived: boolean;
  onQueryChange(value: string): void;
  onIncludeArchivedChange(value: boolean): void;
  onSelect(id: string): void;
  onRefresh(): Promise<void>;
  onError(error: unknown): void;
}

type EpisodeFormInput = z.input<typeof episodeCreateSchema>;
type EpisodeFormValues = z.output<typeof episodeCreateSchema>;
type ReorderConfirmation = {
  orderedSceneIds: string[];
  changes: Array<{ from: string; to: string }>;
};

const episodeStatusTone: Record<Episode['status'], string> = {
  draft: 'border-border bg-muted text-muted-foreground',
  script_ready: 'border-[#b7d4c3] bg-[#e8f4ec] text-[#275f48]',
  archived: 'border-[#d3cec2] bg-[#e5e1d8] text-[#656158]',
};

export function EpisodeWorkspace(props: Props) {
  const [creating, setCreating] = useState(false);
  const form = useForm<EpisodeFormInput, unknown, EpisodeFormValues>({
    resolver: zodResolver(episodeCreateSchema),
    defaultValues: { title: '', topic: '', slug: '', notes: '' },
  });
  const titleField = form.register('title');

  async function createEpisode(values: EpisodeFormValues) {
    try {
      const episode = await window.studio.episodes.create(values);
      setCreating(false);
      form.reset({ title: '', topic: '', slug: '', notes: '' });
      await props.onRefresh();
      props.onSelect(episode.id);
    } catch (error) {
      props.onError(error);
    }
  }

  return (
    <div className="grid min-w-0 grid-cols-[17rem_minmax(0,1fr)] items-start gap-4 max-[1180px]:grid-cols-[15rem_minmax(0,1fr)]">
      <Card className="sticky top-4 max-h-[calc(100vh-6rem)] gap-3 overflow-hidden bg-card/95 py-4 shadow-sm">
        <CardHeader className="flex-row items-center justify-between px-4">
          <div>
            <p className="eyebrow">THƯ VIỆN</p>
            <CardTitle className="mt-1 font-serif text-2xl">Episodes</CardTitle>
          </div>
          <Dialog open={creating} onOpenChange={setCreating}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus aria-hidden="true" /> Mới
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Tạo Episode</DialogTitle>
                <DialogDescription>
                  Khởi tạo metadata cho một Episode mới. Có thể bổ sung scene sau.
                </DialogDescription>
              </DialogHeader>
              <form
                id="create-episode-form"
                className="grid gap-3"
                noValidate
                onSubmit={form.handleSubmit(createEpisode)}
              >
                <Field data-invalid={Boolean(form.formState.errors.title)}>
                  <FieldLabel htmlFor="new-episode-title">Tiêu đề</FieldLabel>
                  <Input
                    id="new-episode-title"
                    aria-invalid={Boolean(form.formState.errors.title)}
                    {...titleField}
                    onChange={(event) => {
                      void titleField.onChange(event);
                      if (!form.getValues('slug')) {
                        form.setValue('slug', slugify(event.target.value), {
                          shouldValidate: true,
                        });
                      }
                    }}
                  />
                  <FieldError errors={[form.formState.errors.title]} />
                </Field>
                <Field data-invalid={Boolean(form.formState.errors.topic)}>
                  <FieldLabel htmlFor="new-episode-topic">Chủ đề</FieldLabel>
                  <Input
                    id="new-episode-topic"
                    aria-invalid={Boolean(form.formState.errors.topic)}
                    {...form.register('topic')}
                  />
                  <FieldError errors={[form.formState.errors.topic]} />
                </Field>
                <Field data-invalid={Boolean(form.formState.errors.slug)}>
                  <FieldLabel htmlFor="new-episode-slug">Slug</FieldLabel>
                  <Input
                    id="new-episode-slug"
                    aria-invalid={Boolean(form.formState.errors.slug)}
                    {...form.register('slug', {
                      onChange: (event) => form.setValue('slug', slugify(event.target.value)),
                    })}
                  />
                  <FieldError errors={[form.formState.errors.slug]} />
                </Field>
                <Field data-invalid={Boolean(form.formState.errors.notes)}>
                  <FieldLabel htmlFor="new-episode-notes">Ghi chú</FieldLabel>
                  <Textarea
                    id="new-episode-notes"
                    rows={3}
                    aria-invalid={Boolean(form.formState.errors.notes)}
                    {...form.register('notes')}
                  />
                  <FieldError errors={[form.formState.errors.notes]} />
                </Field>
              </form>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreating(false)}>
                  Hủy
                </Button>
                <Button
                  type="submit"
                  form="create-episode-form"
                  disabled={form.formState.isSubmitting}
                >
                  Tạo Episode
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent className="grid min-h-0 gap-3 px-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              aria-label="Tìm Episode"
              className="pl-9"
              placeholder="Tìm title, topic, slug…"
              value={props.query}
              onChange={(event) => props.onQueryChange(event.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 px-1 text-xs font-medium text-muted-foreground">
            <Checkbox
              checked={props.includeArchived}
              onCheckedChange={(checked) => props.onIncludeArchivedChange(checked === true)}
            />
            Hiện Episode đã archive
          </label>
          <Separator />
          <div className="grid min-h-0 gap-1 overflow-y-auto pr-1">
            {props.episodes.map((episode) => {
              const active = props.selectedEpisodeId === episode.id;
              return (
                <Button
                  key={episode.id}
                  type="button"
                  variant="ghost"
                  aria-pressed={active}
                  className={`h-auto w-full justify-start rounded-lg px-3 py-2.5 text-left ${
                    active ? 'bg-accent text-accent-foreground' : ''
                  }`}
                  onClick={() => props.onSelect(episode.id)}
                >
                  <span
                    className={`size-2 shrink-0 rounded-full ${
                      episode.status === 'script_ready'
                        ? 'bg-[#2f725b]'
                        : episode.status === 'archived'
                          ? 'bg-[#858178]'
                          : 'bg-primary'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm">{episode.title}</strong>
                    <small className="block truncate font-normal text-muted-foreground">
                      {episode.topic}
                    </small>
                    <em className="block truncate font-mono text-[10px] font-normal not-italic text-muted-foreground">
                      {episode.slug}
                    </em>
                  </span>
                </Button>
              );
            })}
            {props.episodes.length === 0 && (
              <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                Chưa có Episode phù hợp.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <section className="min-w-0">
        {props.detail ? (
          <EpisodeEditor key={props.detail.episode.id} {...props} detail={props.detail} />
        ) : (
          <Card className="grid min-h-52 place-items-center border-dashed text-sm text-muted-foreground shadow-none">
            Chọn hoặc tạo một Episode để bắt đầu.
          </Card>
        )}
      </section>
    </div>
  );
}

function EpisodeEditor({
  detail,
  templates,
  onRefresh,
  onError,
}: Pick<Props, 'detail' | 'templates' | 'onRefresh' | 'onError'> & { detail: EpisodeDetail }) {
  const [meta, setMeta] = useState(detail.episode);
  const [selectedTemplateVersionId, setSelectedTemplateVersionId] = useState(
    detail.script.templateVersionId ?? '',
  );
  const [renderedPrompt, setRenderedPrompt] = useState(detail.script.renderedPromptSnapshot ?? '');
  const [importFormat, setImportFormat] = useState<'markdown' | 'json'>('markdown');
  const [importSource, setImportSource] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [replaceImportOpen, setReplaceImportOpen] = useState(false);
  const [revisions, setRevisions] = useState<ScriptRevision[]>([]);
  const [reorderConfirmation, setReorderConfirmation] = useState<ReorderConfirmation | null>(null);

  useEffect(() => {
    void window.studio.scenes.listRevisions(detail.episode.id).then(setRevisions).catch(onError);
  }, [detail.episode.id, onError]);

  async function saveMeta(event: React.FormEvent) {
    event.preventDefault();
    try {
      await window.studio.episodes.update(meta);
      await onRefresh();
    } catch (error) {
      onError(error);
    }
  }

  async function renderPrompt() {
    if (!selectedTemplateVersionId) return;
    try {
      const result = await window.studio.templates.render({
        templateVersionId: selectedTemplateVersionId,
        episodeId: detail.episode.id,
      });
      setRenderedPrompt(result.rendered);
      await onRefresh();
    } catch (error) {
      onError(error);
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(renderedPrompt);
    } catch (error) {
      onError(error);
    }
  }

  async function addScene() {
    try {
      await window.studio.scenes.create({
        episodeId: detail.episode.id,
        title: '',
        summary: '',
        narration: '',
        imagePrompt: '',
        videoPrompt: '',
      });
      await onRefresh();
    } catch (error) {
      onError(error);
    }
  }

  async function commitReorder(orderedSceneIds: string[]) {
    try {
      await window.studio.scenes.reorder({
        episodeId: detail.episode.id,
        orderedSceneIds,
        confirmed: true,
      });
      await onRefresh();
    } catch (error) {
      onError(error);
    }
  }

  async function moveScene(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= detail.scenes.length) return;
    const orderedSceneIds = detail.scenes.map((scene) => scene.id);
    [orderedSceneIds[index], orderedSceneIds[nextIndex]] = [
      orderedSceneIds[nextIndex],
      orderedSceneIds[index],
    ];
    try {
      const changes = await window.studio.scenes.previewReorder({
        episodeId: detail.episode.id,
        orderedSceneIds,
      });
      if (changes.length) {
        setReorderConfirmation({ orderedSceneIds, changes });
        return;
      }
      await commitReorder(orderedSceneIds);
    } catch (error) {
      onError(error);
    }
  }

  async function importScript() {
    try {
      const revision = await window.studio.scenes.import({
        episodeId: detail.episode.id,
        format: importFormat,
        source: importSource,
        replaceConfirmed: true,
      });
      setRevisions((rows) => [revision, ...rows]);
      setImportSource('');
      setImportOpen(false);
      await onRefresh();
    } catch (error) {
      onError(error);
    }
  }

  function requestImport() {
    if (detail.scenes.length > 0) {
      setReplaceImportOpen(true);
      return;
    }
    void importScript();
  }

  async function saveRevision() {
    try {
      const revision = await window.studio.scenes.saveRevision(detail.episode.id);
      setRevisions((rows) => [revision, ...rows]);
      await onRefresh();
    } catch (error) {
      onError(error);
    }
  }

  async function archive() {
    try {
      await window.studio.episodes.archive(detail.episode.id);
      await onRefresh();
    } catch (error) {
      onError(error);
    }
  }

  async function addReference() {
    try {
      await window.studio.assets.addReference(detail.episode.id);
      await onRefresh();
    } catch (error) {
      onError(error);
    }
  }

  async function deleteReference(id: string) {
    try {
      await window.studio.assets.deleteReference(id);
      await onRefresh();
    } catch (error) {
      onError(error);
    }
  }

  return (
    <div className="grid min-w-0 gap-4">
      <Card className="gap-3 overflow-hidden border-l-4 border-l-primary bg-card/95 py-5 shadow-sm">
        <CardHeader className="flex-row items-start justify-between gap-4 px-5">
          <div className="min-w-0">
            <p className="eyebrow">EPISODE / {detail.episode.slug}</p>
            <h2 className="mt-1 truncate font-serif text-3xl font-semibold tracking-tight">
              {detail.episode.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{detail.episode.topic}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="outline" className={episodeStatusTone[detail.episode.status]}>
              {detail.episode.status}
            </Badge>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="ghost" size="sm">
                  <Archive aria-hidden="true" /> Archive
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archive “{detail.episode.title}”?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Episode sẽ được ẩn khỏi danh sách mặc định nhưng dữ liệu vẫn được giữ lại.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Hủy</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void archive()}>Archive</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
      </Card>

      <details className="group rounded-xl border bg-card shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Thông tin Episode
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <form className="grid gap-3 border-t p-5 lg:grid-cols-2" onSubmit={saveMeta}>
          <Field>
            <FieldLabel htmlFor="episode-title">Tiêu đề</FieldLabel>
            <Input
              id="episode-title"
              value={meta.title}
              onChange={(event) => setMeta({ ...meta, title: event.target.value })}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="episode-topic">Chủ đề</FieldLabel>
            <Input
              id="episode-topic"
              value={meta.topic}
              onChange={(event) => setMeta({ ...meta, topic: event.target.value })}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="episode-slug">Slug</FieldLabel>
            <Input
              id="episode-slug"
              value={meta.slug}
              onChange={(event) => setMeta({ ...meta, slug: slugify(event.target.value) })}
              required
            />
          </Field>
          <Field className="lg:col-span-2">
            <FieldLabel htmlFor="episode-notes">Ghi chú</FieldLabel>
            <Textarea
              id="episode-notes"
              rows={3}
              value={meta.notes}
              onChange={(event) => setMeta({ ...meta, notes: event.target.value })}
            />
          </Field>
          <Button className="w-fit" type="submit">
            Lưu thông tin
          </Button>
        </form>
      </details>

      <Card className="gap-4 bg-card/95 py-5 shadow-sm">
        <CardHeader className="px-5">
          <p className="eyebrow">PROMPT WORKBENCH</p>
          <CardTitle className="text-base">Render prompt</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 px-5">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedTemplateVersionId} onValueChange={setSelectedTemplateVersionId}>
              <SelectTrigger aria-label="Phiên bản template" className="min-w-64 flex-1">
                <SelectValue placeholder="Chọn template version…" />
              </SelectTrigger>
              <SelectContent>
                {templates.flatMap((template) =>
                  template.versions.map((version) => (
                    <SelectItem key={version.id} value={version.id}>
                      {template.name} · v{version.versionNo}
                    </SelectItem>
                  )),
                )}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="secondary"
              onClick={renderPrompt}
              disabled={!selectedTemplateVersionId}
            >
              Render & lưu snapshot
            </Button>
            <Button type="button" variant="outline" onClick={copyPrompt} disabled={!renderedPrompt}>
              <Clipboard aria-hidden="true" /> Copy
            </Button>
          </div>
          {renderedPrompt && (
            <pre className="max-h-72 overflow-auto rounded-lg border bg-[#1f2e39] p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-[#e7ece8]">
              {renderedPrompt}
            </pre>
          )}
        </CardContent>
      </Card>

      <Card className="gap-3 bg-card/95 py-5 shadow-sm">
        <CardHeader className="flex-row items-center justify-between gap-4 px-5">
          <div>
            <p className="eyebrow">CHARACTER REFERENCES</p>
            <CardTitle className="mt-1 text-base">Reference metadata</CardTitle>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={addReference}>
            <ImagePlus aria-hidden="true" /> Chọn ảnh
          </Button>
        </CardHeader>
        <CardContent className="px-5">
          {detail.references.length ? (
            <div className="flex flex-wrap gap-2">
              {detail.references.map((reference) => (
                <div
                  className="flex min-w-56 items-center gap-2 rounded-lg border bg-muted/35 px-3 py-2"
                  key={reference.id}
                >
                  <span
                    className={`size-2 shrink-0 rounded-full ${
                      reference.status === 'available' ? 'bg-[#2f725b]' : 'bg-destructive'
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-xs">{reference.name}</strong>
                    <small className="block text-[10px] text-muted-foreground">
                      {Math.round(reference.sizeBytes / 1024)} KB · {reference.status}
                    </small>
                  </span>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Xóa reference ${reference.name}`}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent size="sm">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Xóa metadata reference?</AlertDialogTitle>
                        <AlertDialogDescription>
                          “{reference.name}” sẽ được gỡ khỏi Episode. File gốc không bị xóa.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          onClick={() => void deleteReference(reference.id)}
                        >
                          Xóa reference
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              Chưa gắn reference. Phase 1 chỉ lưu path, MIME, size và SHA-256.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="gap-4 bg-card/95 py-5 shadow-sm">
        <CardHeader className="flex-row items-center justify-between gap-4 px-5">
          <div>
            <p className="eyebrow">SCRIPT EDITOR</p>
            <CardTitle className="mt-1 text-base">
              {detail.scenes.length} scenes · {revisions.length} revisions
            </CardTitle>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  <FileInput aria-hidden="true" /> Import
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Paste / import script v1</DialogTitle>
                  <DialogDescription>
                    Chọn đúng format và validate toàn bộ nội dung trước khi ghi.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3">
                  <Select
                    value={importFormat}
                    onValueChange={(value) => setImportFormat(value as 'markdown' | 'json')}
                  >
                    <SelectTrigger aria-label="Định dạng import" className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="markdown">Markdown v1</SelectItem>
                      <SelectItem value="json">JSON v1</SelectItem>
                    </SelectContent>
                  </Select>
                  <Textarea
                    rows={12}
                    className="min-h-64 font-mono text-xs"
                    placeholder="Paste script theo schema v1…"
                    value={importSource}
                    onChange={(event) => setImportSource(event.target.value)}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
                    Hủy
                  </Button>
                  <Button type="button" onClick={requestImport} disabled={!importSource.trim()}>
                    Validate & import
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button type="button" variant="outline" size="sm" onClick={saveRevision}>
              Lưu revision
            </Button>
            <Button type="button" size="sm" onClick={addScene}>
              <Plus aria-hidden="true" /> Scene
            </Button>
          </div>
        </CardHeader>

        <CardContent className="grid gap-3 px-5">
          {revisions.length > 0 && (
            <details className="group rounded-md border px-3 py-2">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Lịch sử revision
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-2 divide-y">
                {revisions.map((revision) => (
                  <div
                    className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] gap-2 py-2 text-xs"
                    key={revision.id}
                  >
                    <strong>r{revision.revisionNo}</strong>
                    <span>
                      {revision.source} · {revision.sourceFormat}
                    </span>
                    <small className="text-muted-foreground">
                      {new Date(revision.createdAt).toLocaleString('vi-VN')}
                    </small>
                  </div>
                ))}
              </div>
            </details>
          )}

          <div className="grid gap-3">
            {detail.scenes.map((scene, index) => (
              <SceneCard
                key={scene.id}
                scene={scene}
                references={detail.references}
                canMoveUp={index > 0}
                canMoveDown={index < detail.scenes.length - 1}
                onMove={(direction) => moveScene(index, direction)}
                onRefresh={onRefresh}
                onError={onError}
              />
            ))}
            {detail.scenes.length === 0 && (
              <div className="grid min-h-36 place-items-center rounded-lg border border-dashed text-sm text-muted-foreground">
                Tạo scene thủ công hoặc import script v1.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={Boolean(reorderConfirmation)}
        onOpenChange={(open) => {
          if (!open) setReorderConfirmation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Đổi thứ tự scene và canonical name?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>Reorder sẽ đổi các canonical name sau:</p>
                <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted p-3 font-mono text-xs text-foreground">
                  {reorderConfirmation?.changes
                    .map((change) => `${change.from} → ${change.to}`)
                    .join('\n')}
                </pre>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const orderedSceneIds = reorderConfirmation?.orderedSceneIds;
                setReorderConfirmation(null);
                if (orderedSceneIds) void commitReorder(orderedSceneIds);
              }}
            >
              Xác nhận reorder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={replaceImportOpen} onOpenChange={setReplaceImportOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Thay thế script hiện tại?</AlertDialogTitle>
            <AlertDialogDescription>
              Import sẽ thay thế toàn bộ scene và asset slot hiện tại. Dữ liệu chỉ được ghi khi toàn
              bộ file hợp lệ.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setReplaceImportOpen(false);
                void importScript();
              }}
            >
              Thay thế và import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
