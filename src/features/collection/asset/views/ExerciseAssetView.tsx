import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { IoChevronBack, IoInformationCircle, IoPlay } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import { FullscreenViewerFrame } from '../../../../components/FullscreenViewerFrame';
import { ViewerIconButton } from '../../../../components/ViewerIconButton';
import type { Asset, AssetFile, ExercisePageStatus } from '../../../../domain/models';
import { assetFileStore, assetRepo, exerciseRepo } from '../../../../repositories';
import { useActiveSessionStore } from '../../../../stores/activeSessionStore';
import { useSubjectAccentColor } from '../../../../ui/hooks/useSubjectColors';
import { ErrorPage } from '../../../common/ErrorPage';
import { NotFoundPage } from '../../../common/NotFoundPage';
import { AssetViewer } from '../../../session/viewer/AssetViewer';
import { formatExerciseStatus } from '../../../session/viewer/viewerUtils';

export function ExerciseAssetView(props: { assetId: string }) {
  const navigate = useNavigate();
  const { active, start, end } = useActiveSessionStore();

  const { asset, file, pdfData, loading, error } = useExerciseAssetData(props.assetId);
  const [pageNumber, setPageNumber] = useState(1);
  const { exerciseStatus } = useExerciseStatus(asset?.id);
  const subjectAccent = useSubjectAccentColor(asset?.subjectId);

  const [infoOpen, setInfoOpen] = useState(false);

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

  function startSession() {
    if (!a) return;
    if (active && (active.subjectId !== a.subjectId || active.topicId !== a.topicId)) {
      end();
    }
    if (!active || active.subjectId !== a.subjectId || active.topicId !== a.topicId) {
      start({ subjectId: a.subjectId, topicId: a.topicId });
    }
    navigate(`/study/${a.id}`);
  }

  return (
    <FullscreenViewerFrame
      accentColor={subjectAccent}
      overlayLeft={
        <ViewerIconButton ariaLabel="Zurück" onClick={() => navigate(-1)}>
          <IoChevronBack />
        </ViewerIconButton>
      }
      overlayRight={
        <>
          <ViewerIconButton ariaLabel="Session starten" onClick={startSession}>
            <IoPlay />
          </ViewerIconButton>
          <ViewerIconButton ariaLabel="Info" onClick={() => setInfoOpen(true)}>
            <IoInformationCircle />
          </ViewerIconButton>
        </>
      }
      overlayInfo={
        infoOpen ? (
          <div className="w-[min(420px,calc(100vw-24px))] rounded-2xl border border-white/10 bg-slate-950/85 p-4 text-slate-100 shadow-2xl backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">Info</div>
                <div className="mt-1 truncate text-xs text-slate-300">{a.title}</div>
              </div>
              <ViewerIconButton ariaLabel="Schließen" onClick={() => setInfoOpen(false)}>
                <X className="h-5 w-5" />
              </ViewerIconButton>
            </div>

            <div className="mt-4">
              <div className="text-xs font-semibold text-slate-300">Übungsstatus</div>
              <div className="mt-1 inline-flex items-center rounded-md bg-black/30 px-2 py-1 text-sm">
                {formatExerciseStatus(exerciseStatus)}
              </div>
            </div>
          </div>
        ) : null
      }
    >
      {infoOpen ? (
        <button
          type="button"
          aria-label="Info schließen"
          className="absolute inset-0 z-10 cursor-default bg-transparent"
          onClick={() => setInfoOpen(false)}
        />
      ) : null}

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
    </FullscreenViewerFrame>
  );
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
