import { useEffect, useMemo, useState } from 'react';
import { IoChevronBack, IoInformationCircle, IoPlay } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import { FullscreenViewerFrame } from '../../../../components/FullscreenViewerFrame';
import { ViewerIconButton } from '../../../../components/ViewerIconButton';
import type { Asset, AssetFile } from '../../../../domain/models';
import { assetFileStore, assetRepo } from '../../../../repositories';
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
  const subjectAccent = useSubjectAccentColor(asset?.subjectId);

  const state = useMemo(() => {
    if (loading) return { kind: 'loading' as const };
    if (error) return { kind: 'error' as const, error };
    if (!asset) return { kind: 'notfound' as const };
    if (asset.type !== 'exercise') return { kind: 'notfound' as const };

    return { kind: 'ready' as const, asset };
  }, [loading, error, asset]);

  if (state.kind === 'notfound') return <NotFoundPage />;
  if (state.kind === 'loading')
    return (
      <FullscreenViewerFrame>
        <div className="absolute inset-0 grid place-items-center">
          <div
            role="status"
            aria-label="Lädt"
            className="h-8 w-8 animate-spin rounded-full border-2 border-slate-400/60 border-t-transparent"
          />
        </div>
      </FullscreenViewerFrame>
    );
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
          <ViewerIconButton ariaLabel="Info" onClick={() => {}}>
            <IoInformationCircle />
          </ViewerIconButton>
        </>
      }
    >
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
