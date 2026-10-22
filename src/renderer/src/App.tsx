import { useCallback, useEffect, useState } from 'react';
import { Archive, Clapperboard, DatabaseBackup, LayoutTemplate, WifiOff, X } from 'lucide-react';
import type { Episode, EpisodeDetail, TemplateDetail } from '../../shared/domain.js';
import { BackupWorkspace } from './components/BackupWorkspace';
import { EpisodeWorkspace } from './components/EpisodeWorkspace';
import { TemplateWorkspace } from './components/TemplateWorkspace';
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert';
import { Button } from './components/ui/button';
import { Spinner } from './components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';

type Section = 'episodes' | 'templates' | 'backup';

const sections: Array<{
  value: Section;
  label: string;
  shortLabel: string;
  icon: typeof Clapperboard;
}> = [
  { value: 'episodes', label: 'Episodes', shortLabel: '01', icon: Clapperboard },
  { value: 'templates', label: 'Prompt Templates', shortLabel: '02', icon: LayoutTemplate },
  { value: 'backup', label: 'Backup & Restore', shortLabel: '03', icon: DatabaseBackup },
];

export function App() {
  const [section, setSection] = useState<Section>('episodes');
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [templates, setTemplates] = useState<TemplateDetail[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EpisodeDetail | null>(null);
  const [query, setQuery] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reportError = useCallback((reason: unknown) => {
    const value = reason as { message?: string; details?: string[] };
    const detailText = value.details?.length ? `\n${value.details.join('\n')}` : '';
    setError(`${value.message ?? String(reason)}${detailText}`);
  }, []);

  const loadEpisodes = useCallback(async () => {
    try {
      const rows = await window.studio.episodes.list({ query, includeArchived });
      setEpisodes(rows);
      setSelectedEpisodeId((current) =>
        current && rows.some((episode) => episode.id === current) ? current : (rows[0]?.id ?? null),
      );
    } catch (reason) {
      reportError(reason);
    }
  }, [includeArchived, query, reportError]);

  const loadTemplates = useCallback(async () => {
    try {
      setTemplates(await window.studio.templates.list());
    } catch (reason) {
      reportError(reason);
    }
  }, [reportError]);

  const loadDetail = useCallback(async () => {
    if (!selectedEpisodeId) {
      setDetail(null);
      return;
    }
    try {
      setDetail(await window.studio.episodes.detail(selectedEpisodeId));
    } catch (reason) {
      reportError(reason);
    }
  }, [reportError, selectedEpisodeId]);

  useEffect(() => {
    void Promise.all([loadEpisodes(), loadTemplates()]).finally(() => setLoading(false));
  }, [loadEpisodes, loadTemplates]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function refreshAll() {
    await Promise.all([loadEpisodes(), loadTemplates()]);
    await loadDetail();
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex h-16 items-center gap-3 border-b-[3px] border-primary bg-[#20251f] px-5 text-[#f9f5ea]">
        <div className="grid size-9 shrink-0 place-items-center rounded-full border border-[#657064] font-serif text-lg text-[#ffd7bd]">
          N
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.18em] text-[#b8c0b6]">
            LOCAL PRODUCTION DESK
          </p>
          <h1 className="truncate font-serif text-xl font-semibold tracking-tight">
            Ngoday Studio
          </h1>
        </div>
        <div className="ml-auto inline-flex items-center gap-2 rounded-full border border-[#59665c] px-3 py-1.5 text-xs text-[#dfe5dc] max-[1024px]:hidden">
          <WifiOff className="size-3.5 text-[#ffad87]" aria-hidden="true" />
          Offline-first · Phase 1
        </div>
      </header>

      <Tabs
        value={section}
        onValueChange={(value) => setSection(value as Section)}
        orientation="vertical"
        className="grid min-h-[calc(100vh-4rem)] grid-cols-[13.5rem_minmax(0,1fr)] gap-0 max-[1024px]:grid-cols-[4.75rem_minmax(0,1fr)]"
      >
        <aside className="flex min-h-0 flex-col bg-secondary px-3 py-4 text-secondary-foreground max-[1024px]:px-2">
          <TabsList
            variant="line"
            aria-label="Khu vực ứng dụng"
            className="w-full items-stretch gap-1 text-secondary-foreground"
          >
            {sections.map(({ value, label, shortLabel, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                aria-label={label}
                className="min-h-11 w-full justify-start gap-2.5 rounded-md px-3 text-left text-sm text-[#cbd2d4] after:right-auto after:left-0 after:bg-primary hover:bg-white/5 hover:text-white data-[state=active]:bg-white/10 data-[state=active]:text-white max-[1024px]:justify-center max-[1024px]:px-1"
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="max-[1024px]:hidden">{label}</span>
                <span className="sr-only max-[1024px]:not-sr-only max-[1024px]:text-[10px]">
                  {shortLabel}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="mt-auto rounded-lg border border-white/10 bg-black/10 p-3 text-xs leading-relaxed text-[#b9c1c3] max-[1024px]:hidden">
            <strong className="mb-1 flex items-center gap-2 text-[#f2eee4]">
              <Archive className="size-3.5" aria-hidden="true" /> Phạm vi hiện tại
            </strong>
            <p>Episode, script, scene và asset planning. Không kết nối Google Flow.</p>
          </div>
        </aside>

        <main className="min-w-0 overflow-x-hidden p-5 max-[1180px]:p-4">
          {error && (
            <Alert variant="destructive" className="mb-4 bg-[#fff8f5]" aria-live="assertive">
              <AlertTitle>Không thể hoàn tất thao tác</AlertTitle>
              <AlertDescription className="whitespace-pre-wrap pr-9">{error}</AlertDescription>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-2 top-2"
                aria-label="Đóng thông báo lỗi"
                onClick={() => setError(null)}
              >
                <X aria-hidden="true" />
              </Button>
            </Alert>
          )}

          {loading ? (
            <div
              className="grid min-h-56 place-items-center text-sm text-muted-foreground"
              aria-live="polite"
            >
              <span className="flex items-center gap-2">
                <Spinner className="size-5 text-primary" /> Đang mở studio…
              </span>
            </div>
          ) : (
            <>
              <TabsContent value="episodes" className="mt-0">
                <EpisodeWorkspace
                  episodes={episodes}
                  selectedEpisodeId={selectedEpisodeId}
                  detail={detail}
                  templates={templates}
                  query={query}
                  includeArchived={includeArchived}
                  onQueryChange={setQuery}
                  onIncludeArchivedChange={setIncludeArchived}
                  onSelect={setSelectedEpisodeId}
                  onRefresh={refreshAll}
                  onError={reportError}
                />
              </TabsContent>
              <TabsContent value="templates" className="mt-0">
                <TemplateWorkspace
                  templates={templates}
                  onRefresh={loadTemplates}
                  onError={reportError}
                />
              </TabsContent>
              <TabsContent value="backup" className="mt-0">
                <BackupWorkspace onRefresh={refreshAll} onError={reportError} />
              </TabsContent>
            </>
          )}
        </main>
      </Tabs>
    </div>
  );
}
