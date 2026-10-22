import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, Library, Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { TemplateDetail } from '../../../shared/domain.js';
import { templateCreateSchema } from '../../../shared/schemas.js';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Field, FieldError, FieldLabel } from './ui/field';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';

type TemplateFormInput = z.input<typeof templateCreateSchema>;
type TemplateFormValues = z.output<typeof templateCreateSchema>;

const initialContent = 'Write a script for {{episode_title}} about {{topic}}.\nNotes: {{notes}}';

export function TemplateWorkspace({
  templates,
  onRefresh,
  onError,
}: {
  templates: TemplateDetail[];
  onRefresh(): Promise<void>;
  onError(error: unknown): void;
}) {
  const [versionDrafts, setVersionDrafts] = useState<Record<string, string>>({});
  const form = useForm<TemplateFormInput, unknown, TemplateFormValues>({
    resolver: zodResolver(templateCreateSchema),
    defaultValues: { name: '', purpose: '', content: initialContent },
  });

  async function create(values: TemplateFormValues) {
    try {
      await window.studio.templates.create(values);
      form.reset({ name: '', purpose: '', content: initialContent });
      await onRefresh();
    } catch (error) {
      onError(error);
    }
  }

  async function createVersion(templateId: string) {
    const next = versionDrafts[templateId];
    if (!next?.trim()) return;
    try {
      await window.studio.templates.createVersion({ templateId, content: next });
      setVersionDrafts((values) => ({ ...values, [templateId]: '' }));
      await onRefresh();
    } catch (error) {
      onError(error);
    }
  }

  return (
    <div className="grid gap-4">
      <header className="px-1 py-1">
        <p className="eyebrow">PROMPT LIBRARY</p>
        <h2 className="font-serif text-3xl font-semibold tracking-tight">Template versions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Mỗi lần thay đổi tạo một version mới; version cũ không bị ghi đè.
        </p>
      </header>

      <Card className="gap-4 bg-card/95 py-5 shadow-sm">
        <CardHeader className="flex-row items-center justify-between gap-4 px-5">
          <CardTitle className="text-base">Tạo template</CardTitle>
          <span className="font-mono text-[11px] text-muted-foreground">
            Biến: {'{{topic}}'} · {'{{episode_title}}'} · {'{{notes}}'}
          </span>
        </CardHeader>
        <CardContent className="px-5">
          <form className="grid gap-3" noValidate onSubmit={form.handleSubmit(create)}>
            <div className="grid gap-3 lg:grid-cols-2">
              <Field data-invalid={Boolean(form.formState.errors.name)}>
                <FieldLabel htmlFor="template-name">Tên</FieldLabel>
                <Input
                  id="template-name"
                  aria-invalid={Boolean(form.formState.errors.name)}
                  {...form.register('name')}
                />
                <FieldError errors={[form.formState.errors.name]} />
              </Field>
              <Field data-invalid={Boolean(form.formState.errors.purpose)}>
                <FieldLabel htmlFor="template-purpose">Mục đích</FieldLabel>
                <Input
                  id="template-purpose"
                  aria-invalid={Boolean(form.formState.errors.purpose)}
                  {...form.register('purpose')}
                />
                <FieldError errors={[form.formState.errors.purpose]} />
              </Field>
            </div>
            <Field data-invalid={Boolean(form.formState.errors.content)}>
              <FieldLabel htmlFor="template-content">Nội dung</FieldLabel>
              <Textarea
                id="template-content"
                rows={5}
                className="min-h-28 font-mono text-xs"
                aria-invalid={Boolean(form.formState.errors.content)}
                {...form.register('content')}
              />
              <FieldError errors={[form.formState.errors.content]} />
            </Field>
            <Button className="w-fit" type="submit" disabled={form.formState.isSubmitting}>
              <Plus aria-hidden="true" /> Tạo version 1
            </Button>
          </form>
        </CardContent>
      </Card>

      {templates.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {templates.map((template) => (
            <Card key={template.id} className="gap-4 bg-card/95 py-5 shadow-sm">
              <CardHeader className="flex-row items-start justify-between gap-4 px-5">
                <div className="min-w-0">
                  <p className="eyebrow">{template.purpose || 'GENERAL'}</p>
                  <CardTitle className="mt-1 truncate">{template.name}</CardTitle>
                </div>
                <Badge variant="secondary" className="font-mono">
                  v{template.versions[0]?.versionNo ?? 0}
                </Badge>
              </CardHeader>
              <CardContent className="grid gap-3 px-5">
                <pre className="max-h-40 min-h-20 overflow-auto rounded-md border bg-muted/55 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                  {template.versions[0]?.content}
                </pre>
                <details className="group rounded-md border bg-background/70 p-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    Tạo version mới
                    <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-3 grid gap-2">
                    <Textarea
                      rows={5}
                      className="font-mono text-xs"
                      aria-label={`Nội dung version mới cho ${template.name}`}
                      value={versionDrafts[template.id] ?? template.versions[0]?.content ?? ''}
                      onChange={(event) =>
                        setVersionDrafts((values) => ({
                          ...values,
                          [template.id]: event.target.value,
                        }))
                      }
                    />
                    <Button
                      variant="secondary"
                      className="w-fit"
                      onClick={() => createVersion(template.id)}
                    >
                      Lưu version mới
                    </Button>
                  </div>
                </details>
                <details className="group rounded-md border px-3 py-2">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    Lịch sử {template.versions.length} versions
                    <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-2 divide-y">
                    {template.versions.map((version) => (
                      <div
                        className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] gap-2 py-2 text-xs"
                        key={version.id}
                      >
                        <strong>v{version.versionNo}</strong>
                        <span>{new Date(version.createdAt).toLocaleString('vi-VN')}</span>
                        <small className="text-muted-foreground">
                          {version.allowedVariables.join(', ') || 'Không dùng biến'}
                        </small>
                      </div>
                    ))}
                  </div>
                </details>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="items-center gap-2 border-dashed py-10 text-center shadow-none">
          <Library className="size-7 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Chưa có prompt template.</p>
        </Card>
      )}
    </div>
  );
}
