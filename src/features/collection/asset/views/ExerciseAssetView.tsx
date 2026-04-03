import { useCallback, useEffect, useMemo, useState } from 'react';
import { IoChevronBack, IoInformationCircle, IoPlay } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import { FullscreenViewerFrame } from '../../../../components/FullscreenViewerFrame';
import { ViewerIconButton } from '../../../../components/ViewerIconButton';
import type { Asset, AssetFile } from '../../../../domain/models';
import { useInkStore } from '../../../../ink/inkStore';
import { formatAssetFileLabel } from '../../../../lib/assetFileLabel';
import { assetFileStore, assetRepo, inkRepo } from '../../../../repositories';
import { useActiveSessionStore } from '../../../../stores/activeSessionStore';
import { useAssetsStore } from '../../../../stores/assetsStore';
import { usePageSurfaceTheme, useSubjectAccentColor } from '../../../../ui/hooks/useSubjectColors';
import { useSubjectTopicLabels } from '../../../../ui/hooks/useSubjectTopicLabels';
import { ErrorPage } from '../../../common/ErrorPage';
import { NotFoundPage } from '../../../common/NotFoundPage';
import { ExerciseAssetHeaderMorph } from '../../../session/components/ExerciseAssetHeaderMorph';
import { getAttemptHistoryForAsset } from '../../../session/utils/attemptHistory';
import { AssetViewer } from '../../../session/viewer/AssetViewer';

export function ExerciseAssetView(props: { assetId: string }) {
  const navigate = useNavigate();
  const { active, start, end } = useActiveSessionStore();

  const updateAsset = useAssetsStore((s) => s.updateAsset);
  const deleteAsset = useAssetsStore((s) => s.deleteAsset);
  const getFile = useAssetsStore((s) => s.getFile);
  const { asset, file, pdfData, loading, error, refreshAsset } = useExerciseAssetData(
    props.assetId,
  );
  const [assetHeaderBusy, setAssetHeaderBusy] = useState<'rename' | 'delete' | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [supersededAttemptIds, setSupersededAttemptIds] = useState<ReadonlySet<string> | null>(
    null,
  );
  const subjectAccent = useSubjectAccentColor(asset?.subjectId);
  const pageSurfaceTheme = usePageSurfaceTheme(asset?.subjectId);
  const clearInkContext = useInkStore((s) => s.setContext);
  const hydrateInk = useInkStore((s) => s.hydrate);

  const { subtitle: assetTopicSubtitle } = useSubjectTopicLabels(asset?.subjectId, asset?.topicId);

  const getExportStrokes = useCallback(async () => {
    if (!asset || asset.type !== 'exercise') return [];
    let superseded = supersededAttemptIds;
    if (!superseded) {
      const h = await getAttemptHistoryForAsset(asset.id);
      superseded = h.supersededAttemptIds;
    }
    const all = await inkRepo.listByAssetId(asset.id);
    return all.filter((s) => !superseded.has(s.attemptId));
  }, [asset, supersededAttemptIds]);

  const state = useMemo(() => {
    if (loading) return { kind: 'loading' as const };
    if (error) return { kind: 'error' as const, error };
    if (!asset) return { kind: 'notfound' as const };
    if (asset.type !== 'exercise') return { kind: 'notfound' as const };

    return { kind: 'ready' as const, asset };
  }, [loading, error, asset]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const history = await getAttemptHistoryForAsset(props.assetId);
      if (!cancelled) setSupersededAttemptIds(history.supersededAttemptIds);
    })();
    return () => {
      cancelled = true;
    };
  }, [props.assetId]);

  useEffect(() => {
    return () => {
      clearInkContext(null);
      hydrateInk([]);
    };
  }, [clearInkContext, hydrateInk]);

  if (state.kind === 'notfound') return <NotFoundPage />;
  if (state.kind === 'loading')
    return (
      <FullscreenViewerFrame surfaceTheme={pageSurfaceTheme}>
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

  const fileLabel = formatAssetFileLabel(file);

  function startSession() {
    if (!a) return;
    if (active && (active.subjectId !== a.subjectId || active.topicId !== a.topicId)) {
      end();
    }
    if (!active || active.subjectId !== a.subjectId || active.topicId !== a.topicId) {
      start({ subjectId: a.subjectId, topicId: a.topicId });
    }
    navigate(`/study/${a.subjectId}/${a.id}`);
  }

  return (
    <FullscreenViewerFrame
      surfaceTheme={pageSurfaceTheme}
      overlayLeft={
        <div className="flex max-w-[calc(100vw-3rem)] items-start gap-2">
          <ViewerIconButton ariaLabel="Zurück" onClick={() => navigate(-1)}>
            <IoChevronBack />
          </ViewerIconButton>
          <ExerciseAssetHeaderMorph
            title={a.title}
            subtitle={assetTopicSubtitle}
            fileLabel={fileLabel}
            assetId={a.id}
            assetType={a.type}
            loadFile={getFile}
            getExportStrokes={getExportStrokes}
            renameBusy={assetHeaderBusy === 'rename'}
            deleteBusy={assetHeaderBusy === 'delete'}
            onRename={async (nextTitle) => {
              setAssetHeaderBusy('rename');
              try {
                await updateAsset(a.id, a.topicId, { title: nextTitle });
                await refreshAsset();
              } finally {
                setAssetHeaderBusy(null);
              }
            }}
            onDelete={async () => {
              setAssetHeaderBusy('delete');
              try {
                await deleteAsset(a.id, a.topicId);
                navigate(`/subjects/${a.subjectId}/topics/${a.topicId}`);
              } finally {
                setAssetHeaderBusy(null);
              }
            }}
          />
        </div>
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
          ink={{
            kind: 'asset',
            assetId: a.id,
            readonly: true,
            activeAttemptId: null,
            supersededAttemptIds,
          }}
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

  const refreshAsset = useCallback(async () => {
    try {
      const row = await assetRepo.get(assetId);
      setAsset(row ?? null);
      if (row) {
        const f = await assetFileStore.get(row.id);
        if (f) {
          setFile(f);
          const isPdf =
            f.mimeType === 'application/pdf' || f.originalName.toLowerCase().endsWith('.pdf');
          if (isPdf) {
            const buf = await f.blob.arrayBuffer();
            setPdfData(new Uint8Array(buf).slice(0));
          } else {
            setPdfData(null);
          }
        } else {
          setFile(null);
          setPdfData(null);
        }
      } else {
        setFile(null);
        setPdfData(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    }
  }, [assetId]);

  return { asset, file, pdfData, loading, error, refreshAsset };
}
