import { useEffect, useMemo, useRef, useState } from 'react';
import { IoChevronBack } from 'react-icons/io5';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { SecondaryButton } from '../../../components/Button';
import { PageHeader } from '../../../components/PageHeader';
import { ViewerIconButton } from '../../../components/ViewerIconButton';
import type { Asset, AssetType } from '../../../domain/models';
import { downloadBlob, openBlobInNewTab } from '../../../lib/blob';
import { exerciseRepo } from '../../../repositories';
import { useActiveSessionStore } from '../../../stores/activeSessionStore';
import { useAssetsStore } from '../../../stores/assetsStore';
import { useFoldersStore } from '../../../stores/foldersStore';
import { useNotificationsStore } from '../../../stores/notificationsStore';
import { useSubjectsStore } from '../../../stores/subjectsStore';
import { useTopicsStore } from '../../../stores/topicsStore';
import { NotFoundPage } from '../../common/NotFoundPage';
import {
  SessionReviewModal,
  type SessionSummaryState,
} from '../../session/modals/SessionReviewModal';
import { TopicAssetsView } from './components/TopicAssetsView';
import { TopicCurriculumView } from './components/TopicCurriculumView';
import { TopicSummaryPanel } from './components/TopicSummaryPanel';
import { BulkExerciseUploadModal } from './modals/BulkExerciseUploadModal';
import { clearTopicSummaryCache } from './utils/topicSummaryCache';

export function TopicPage() {
  const { subjectId, topicId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { active } = useActiveSessionStore();
  const from = (location.state as { from?: string } | null)?.from;

  const { subjects, refresh: refreshSubjects } = useSubjectsStore();
  const { topicsBySubject, refreshBySubject } = useTopicsStore();
  const { foldersByTopic } = useFoldersStore();
  const pushNotification = useNotificationsStore((s) => s.push);

  const {
    assetsByTopic,
    loadingByTopic: assetsLoadingByTopic,
    errorByTopic: assetsErrorByTopic,
    refreshByTopic: refreshAssetsByTopic,
    createWithFile,
    deleteAsset,
    getFile,
  } = useAssetsStore();

  useEffect(() => {
    void refreshSubjects();
  }, [refreshSubjects]);

  useEffect(() => {
    if (subjectId) void refreshBySubject(subjectId);
  }, [subjectId, refreshBySubject]);

  useEffect(() => {
    if (topicId) void refreshAssetsByTopic(topicId);
  }, [topicId, refreshAssetsByTopic]);

  const subject = useMemo(() => subjects.find((s) => s.id === subjectId), [subjects, subjectId]);

  const topic = useMemo(() => {
    if (!subjectId) return undefined;
    return (topicsBySubject[subjectId] ?? []).find((t) => t.id === topicId);
  }, [topicsBySubject, subjectId, topicId]);

  const folders = useMemo(
    () => (topicId ? (foldersByTopic[topicId] ?? []) : []),
    [foldersByTopic, topicId],
  );

  const assets = useMemo(
    () => (topicId ? (assetsByTopic[topicId] ?? []) : []),
    [assetsByTopic, topicId],
  );
  const assetsLoading = topicId ? (assetsLoadingByTopic[topicId] ?? false) : false;
  const assetsError = topicId ? assetsErrorByTopic[topicId] : undefined;

  const folderNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of folders) map.set(f.id, f.name);
    return map;
  }, [folders]);

  const [assetFilter, setAssetFilter] = useState<'all' | AssetType>('all');
  const [viewMode, setViewMode] = useState<'assets' | 'curriculum'>('assets');

  const [sessionSummary, setSessionSummary] = useState<SessionSummaryState | null>(null);
  const [topicSummaryRegenKey, setTopicSummaryRegenKey] = useState(0);
  useEffect(() => {
    const state = location.state as { sessionSummary?: SessionSummaryState; from?: string } | null;
    const s = state?.sessionSummary;
    if (!s) return;
    queueMicrotask(() => {
      setSessionSummary(s);
      if (topicId && s.topicId === topicId) {
        clearTopicSummaryCache(topicId);
        setTopicSummaryRegenKey((k) => k + 1);
      }
    });
    const nextState = state ? { ...state } : null;
    if (nextState) delete nextState.sessionSummary;
    navigate(location.pathname, {
      replace: true,
      state: nextState && Object.keys(nextState).length > 0 ? nextState : null,
    });
  }, [location.state, location.pathname, navigate, topicId]);

  const filteredAssets = useMemo(() => {
    if (assetFilter === 'all') return assets;
    return assets.filter((a) => a.type === assetFilter);
  }, [assets, assetFilter]);

  const [exerciseStatusByAssetId, setExerciseStatusByAssetId] = useState<
    Record<string, 'unknown' | 'partial' | 'captured' | 'covered'>
  >({});

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const exerciseIds = assets.filter((a) => a.type === 'exercise').map((a) => a.id);
      if (exerciseIds.length === 0) {
        if (!cancelled) setExerciseStatusByAssetId({});
        return;
      }
      const pairs = await Promise.all(
        exerciseIds.map(async (id) => {
          const ex = await exerciseRepo.getByAsset(id);
          return [id, ex?.status ?? 'unknown'] as const;
        }),
      );
      if (!cancelled) setExerciseStatusByAssetId(Object.fromEntries(pairs));
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [assets]);

  const bulkFileInputRef = useRef<HTMLInputElement | null>(null);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [bulkUploadFiles, setBulkUploadFiles] = useState<File[]>([]);

  const goBack = () => {
    if (subjectId) {
      navigate(
        `/subjects/${subjectId}`,
        from
          ? {
              state: { from },
            }
          : undefined,
      );
    } else if (from) {
      navigate(from);
    } else {
      navigate('/dashboard');
    }
  };

  function startBulkExerciseUpload() {
    setBulkUploadFiles([]);
    setBulkUploadOpen(true);
  }

  async function openAsset(asset: Asset) {
    if (asset.type === 'exercise') {
      const navState = {
        from,
        subjectId,
        topicId,
      };
      if (active) navigate(`/study/${asset.id}`, { state: navState });
      else navigate(`${location.pathname.replace(/\/$/, '')}/${asset.id}`, { state: navState });
      return;
    }
    const file = await getFile(asset.id);
    if (!file) return;
    openBlobInNewTab(file.blob);
  }

  async function downloadAsset(asset: Asset) {
    const file = await getFile(asset.id);
    if (!file) return;
    downloadBlob(file.blob, file.originalName);
  }

  if (!subjectId || !topicId) return <NotFoundPage />;
  if (subjects.length > 0 && !subject) return <NotFoundPage />;
  if (!topic && (topicsBySubject[subjectId]?.length ?? 0) > 0) return <NotFoundPage />;

  return (
    <div className="h-full pb-16">
      <ViewerIconButton ariaLabel="Zurück" onClick={goBack} className="fixed left-6 top-6">
        <IoChevronBack />
      </ViewerIconButton>
      <div className="px-6 pt-6">
        <PageHeader
          title={topic ? `${topic.iconEmoji ? topic.iconEmoji + ' ' : ''}${topic.name}` : 'Thema'}
          actions={
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'assets', label: 'Übungen' },
                { key: 'curriculum', label: 'Kapitel & Skills' },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setViewMode(option.key as 'assets' | 'curriculum')}
                  className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                    viewMode === option.key
                      ? 'border-white bg-white text-black'
                      : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                  }`}
                >
                  {option.label}
                </button>
              ))}
              <SecondaryButton
                onClick={() => navigate(`/subjects/${subjectId}/topics/${topicId}/learnpath`)}
              >
                Wissenspfad
              </SecondaryButton>
            </div>
          }
        />
      </div>
      <div>
        <div className="space-y-6">
          <TopicSummaryPanel
            topicId={topicId}
            topicName={topic?.name}
            subjectName={subject?.name}
            assets={assets}
            exerciseStatusByAssetId={exerciseStatusByAssetId}
            onOpenCurriculum={() => setViewMode('curriculum')}
            onOpenLearnPath={() => navigate(`/subjects/${subjectId}/topics/${topicId}/learnpath`)}
            sessionRegenKey={topicSummaryRegenKey}
          />

          <section className="lg:col-span-2 px-6">
            {viewMode === 'assets' ? (
              <TopicAssetsView
                assetsError={assetsError}
                assetFilter={assetFilter}
                onFilterChange={setAssetFilter}
                onUpload={startBulkExerciseUpload}
                assetsLoading={assetsLoading}
                assets={filteredAssets}
                folderNameById={folderNameById}
                exerciseStatusByAssetId={exerciseStatusByAssetId}
                loadFile={getFile}
                onOpen={openAsset}
                onDownload={downloadAsset}
                onDelete={(asset) => {
                  if (window.confirm(`Asset „${asset.title}“ löschen?`)) {
                    void deleteAsset(asset.id, topicId);
                  }
                }}
              />
            ) : (
              <TopicCurriculumView subjectId={subjectId} topicId={topicId} assets={assets} />
            )}
          </section>
        </div>
      </div>
      {/* <div className="w-1/3 pt-20 h-full">
        <div className="w-full h-full bg-white/5 rounded-3xl shadow-lg border border-white/5 p-4">
          <div className="text-sm font-medium text-white">Übersicht</div>
        </div>
      </div> */}

      <BulkExerciseUploadModal
        open={bulkUploadOpen}
        files={bulkUploadFiles}
        folders={folders}
        subjectId={subjectId}
        topicId={topicId}
        onClose={() => {
          setBulkUploadOpen(false);
          setBulkUploadFiles([]);
        }}
        onRequestPick={() => bulkFileInputRef.current?.click()}
        createWithFile={createWithFile}
        onSuccess={(message) => pushNotification({ tone: 'success', title: 'Upload', message })}
        onError={(message) =>
          pushNotification({ tone: 'error', title: 'Upload fehlgeschlagen', message })
        }
      />

      <SessionReviewModal
        key={sessionSummary ? `${sessionSummary.startedAtMs}-${sessionSummary.endedAtMs}` : 'none'}
        open={!!sessionSummary}
        onClose={() => setSessionSummary(null)}
        summary={sessionSummary}
        subjectName={subject?.name}
        topicName={topic?.name}
      />

      <input
        ref={bulkFileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.currentTarget.files ?? []);
          e.currentTarget.value = '';
          if (!files.length) return;
          setBulkUploadFiles(files);
        }}
      />
    </div>
  );
}
