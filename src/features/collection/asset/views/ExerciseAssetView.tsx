import { ArrowLeft, CirclePlay, Info, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Asset, AssetFile, ExercisePageStatus } from '../../../../domain/models';
import { assetFileStore, assetRepo, exerciseRepo } from '../../../../repositories';
import { useActiveSessionStore } from '../../../../stores/activeSessionStore';
import { useSubjectAccentColor } from '../../../../ui/hooks/useSubjectColors';
import { ErrorPage } from '../../../common/ErrorPage';
import { NotFoundPage } from '../../../common/NotFoundPage';
import { AssetViewer } from '../../../session/viewer/AssetViewer';

export function ExerciseAssetView(props: { assetId: string }) {
  const navigate = useNavigate();
  const { active, start, end } = useActiveSessionStore();

  const { asset, file, pdfData, loading, error } = useExerciseAssetData(props.assetId);
  const [pageNumber, setPageNumber] = useState(1);
  const { exerciseStatus } = useExerciseStatus(asset?.id);
  const subjectAccent = useSubjectAccentColor(asset?.subjectId);

  const [infoOpen, setInfoOpen] = useState(false);
  const [navH, setNavH] = useState(0);

  useLayoutEffect(() => {
    const header = document.querySelector('header');
    if (!header) return;
    const update = () => {
      const rect = header.getBoundingClientRect();
      setNavH(Math.ceil(rect.height));
    };
    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(header);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  const state = useMemo(() => {
    if (loading) return { kind: 'loading' as const };
    if (error) return { kind: 'error' as const, error };
    if (!asset) return { kind: 'notfound' as const };
    if (asset.type !== 'exercise') return { kind: 'notfound' as const };

    return { kind: 'ready' as const, asset };
  }, [loading, error, asset]);

  if (state.kind === 'notfound') return <NotFoundPage />;
  if (state.kind === 'loading') return <div className="text-sm text-slate-400">Lade…</div>;
  if (state.kind === 'error') return <ErrorPage title="Fehler beim Laden" message={state.error} />;

  const a = state.asset;

  const backgroundTint = hexToRgba(subjectAccent, 0.3);

  return (
    <div className="fixed inset-0 z-40" style={{ backgroundColor: '#ffffff' }}>
      <div className="absolute inset-0" style={{ backgroundColor: backgroundTint }} />
      {file ? (
        <AssetViewer
          title={a.title}
          file={file}
          pdfData={pdfData}
          pageNumber={pageNumber}
          onPageNumberChange={setPageNumber}
          accentColor={subjectAccent}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center p-4">
          <div className="rounded-md border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
            Datei nicht gefunden (local file missing).
          </div>
        </div>
      )}

      {/* Overlay controls */}
      <div className="absolute left-3 z-10" style={{ top: navH + 12 }}>
        <IconButton ariaLabel="Zurück" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </IconButton>
      </div>
      <div className="absolute right-3 z-10 flex items-center gap-2" style={{ top: navH + 12 }}>
        <IconButton
          ariaLabel="Session starten"
          onClick={() => {
            if (!a) return;
            if (active && (active.subjectId !== a.subjectId || active.topicId !== a.topicId)) {
              end();
            }
            if (!active || active.subjectId !== a.subjectId || active.topicId !== a.topicId) {
              start({ subjectId: a.subjectId, topicId: a.topicId });
            }
          }}
        >
          <CirclePlay className="h-5 w-5" />
        </IconButton>
        <IconButton ariaLabel="Info" onClick={() => setInfoOpen(true)}>
          <Info className="h-5 w-5" />
        </IconButton>
      </div>

      {infoOpen ? (
        <div className="absolute inset-0">
          <button
            type="button"
            aria-label="Info schließen"
            className="absolute inset-0 cursor-default bg-transparent"
            onClick={() => setInfoOpen(false)}
          />
          <div
            className="absolute right-3 w-[min(420px,calc(100vw-24px))] rounded-2xl border border-white/10 bg-slate-950/85 p-4 text-slate-100 shadow-2xl backdrop-blur"
            style={{ top: navH + 56 }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">Info</div>
                <div className="mt-1 truncate text-xs text-slate-300">{a.title}</div>
              </div>
              <IconButton ariaLabel="Schließen" onClick={() => setInfoOpen(false)}>
                <X className="h-5 w-5" />
              </IconButton>
            </div>

            <div className="mt-4">
              <div className="text-xs font-semibold text-slate-300">Übungsstatus</div>
              <div className="mt-1 inline-flex items-center rounded-md bg-black/30 px-2 py-1 text-sm">
                {formatExerciseStatus(exerciseStatus)}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function IconButton(props: { ariaLabel: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={props.ariaLabel}
      onClick={props.onClick}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white backdrop-blur transition hover:bg-black/45 active:bg-black/55"
    >
      {props.children}
    </button>
  );
}

function formatExerciseStatus(status: ExercisePageStatus) {
  switch (status) {
    case 'unknown':
      return 'Unbekannt';
    case 'partial':
      return 'Teilweise';
    case 'captured':
      return 'Erfasst';
    case 'covered':
      return 'Abgedeckt';
    default:
      return status;
  }
}

function hexToRgba(hex: string | undefined, alpha: number) {
  if (!hex) return `rgba(0,0,0,${alpha})`;
  const raw = hex.trim().replace('#', '');
  if (raw.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  if (![r, g, b].every((n) => Number.isFinite(n))) return `rgba(0,0,0,${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function useExerciseStatus(assetId: string | undefined) {
  const [exerciseStatus, setExerciseStatus] = useState<ExercisePageStatus>('unknown');

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!assetId) return;
      const ex = await exerciseRepo.getByAsset(assetId);
      if (cancelled) return;
      setExerciseStatus(ex?.status ?? 'unknown');
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  return { exerciseStatus };
}

function useExerciseAssetData(assetId: string) {
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<AssetFile | null>(null);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const a = await assetRepo.get(assetId);
        if (!cancelled) setAsset(a ?? null);

        if (a) {
          const f = await assetFileStore.get(a.id);
          if (!cancelled && f) {
            setFile(f);
            const isPdf =
              f.mimeType === 'application/pdf' || f.originalName.toLowerCase().endsWith('.pdf');
            if (isPdf) {
              const buf = await f.blob.arrayBuffer();
              setPdfData(new Uint8Array(buf).slice(0));
            } else {
              setPdfData(null);
            }
          } else if (!cancelled) {
            setFile(null);
            setPdfData(null);
          }
        } else if (!cancelled) {
          setFile(null);
          setPdfData(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Fehler');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  return { asset, file, pdfData, loading, error };
}
