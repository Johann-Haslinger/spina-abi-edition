import { FileUp } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AutoBreadcrumbs } from '../../../components/AutoBreadcrumbs';
import { PageHeader } from '../../../components/PageHeader';
import type { Asset, AssetType } from '../../../domain/models';
import { downloadBlob, openBlobInNewTab } from '../../../lib/blob';
import { exerciseRepo } from '../../../repositories';
import { useActiveSessionStore } from '../../../stores/activeSessionStore';
import { useAssetsStore } from '../../../stores/assetsStore';
import { useFoldersStore } from '../../../stores/foldersStore';
import { useSubjectsStore } from '../../../stores/subjectsStore';
import { useTopicsStore } from '../../../stores/topicsStore';
import { NotFoundPage } from '../../common/NotFoundPage';
import {
  SessionReviewModal,
  type SessionSummaryState,
} from '../../session/modals/SessionReviewModal';
import { AssetItem } from './components/AssetItem';
import { FilterChip } from './components/FilterChip';
import { UploadAssetModal } from './modals/UploadAssetModal';

export function TopicPage() {
  const { subjectId, topicId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { active } = useActiveSessionStore();

  const { subjects, refresh: refreshSubjects } = useSubjectsStore();
  const { topicsBySubject, refreshBySubject } = useTopicsStore();
  const { foldersByTopic } = useFoldersStore();

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
    () => (topicId ? foldersByTopic[topicId] ?? [] : []),
    [foldersByTopic, topicId],
  );

  const assets = useMemo(
    () => (topicId ? assetsByTopic[topicId] ?? [] : []),
    [assetsByTopic, topicId],
  );
  const assetsLoading = topicId ? assetsLoadingByTopic[topicId] ?? false : false;
  const assetsError = topicId ? assetsErrorByTopic[topicId] : undefined;

  const folderNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of folders) map.set(f.id, f.name);
    return map;
  }, [folders]);

  const [assetFilter, setAssetFilter] = useState<'all' | AssetType>('all');

  const [sessionSummary, setSessionSummary] = useState<SessionSummaryState | null>(null);
  useEffect(() => {
    const state = location.state as { sessionSummary?: SessionSummaryState; from?: string } | null;
    const s = state?.sessionSummary;
    if (!s) return;
    setSessionSummary(s);
    const nextState = state ? { ...state } : null;
    if (nextState) delete nextState.sessionSummary;
    navigate(location.pathname, {
      replace: true,
      state: nextState && Object.keys(nextState).length > 0 ? nextState : null,
    });
  }, [location.state, location.pathname, navigate]);

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

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<AssetType>('exercise');

  function startUpload(type: AssetType) {
    setUploadType(type);
    fileInputRef.current?.click();
  }

  async function openAsset(asset: Asset) {
    if (asset.type === 'exercise') {
      const navState = {
        from: (location.state as { from?: string } | null)?.from,
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
    <div className="space-y-6">
      <SessionReviewModal
        key={sessionSummary ? `${sessionSummary.startedAtMs}-${sessionSummary.endedAtMs}` : 'none'}
        open={!!sessionSummary}
        onClose={() => setSessionSummary(null)}
        summary={sessionSummary}
        subjectName={subject?.name}
        topicName={topic?.name}
      />

      <PageHeader
        breadcrumb={<AutoBreadcrumbs />}
        title={topic ? `${topic.iconEmoji ? topic.iconEmoji + ' ' : ''}${topic.name}` : 'Thema'}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          e.currentTarget.value = '';
          if (!f) return;
          setUploadFile(f);
          setUploadOpen(true);
        }}
      />

      <div>
        {/* <TopicFolderSection /> */}

        <section className="lg:col-span-2">
          {assetsError ? (
            <div className="mt-3 rounded-md border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
              {assetsError}
            </div>
          ) : null}

          <div className="flex justify-between items-center">
            <div className="flex flex-wrap items-center gap-2">
              <FilterChip
                active={assetFilter === 'all'}
                onClick={() => setAssetFilter('all')}
                label="Alle"
              />
              <FilterChip
                active={assetFilter === 'exercise'}
                onClick={() => setAssetFilter('exercise')}
                label="Übungen"
              />
              <FilterChip
                active={assetFilter === 'cheatsheet'}
                onClick={() => setAssetFilter('cheatsheet')}
                label="Merkblätter"
              />
              <FilterChip
                active={assetFilter === 'note'}
                onClick={() => setAssetFilter('note')}
                label="Notizen"
              />
              <FilterChip
                active={assetFilter === 'file'}
                onClick={() => setAssetFilter('file')}
                label="Dateien"
              />
            </div>
            <button
              type="button"
              onClick={() => startUpload('exercise')}
              className="inline-flex items-center gap-2 rounded-md bg-white/5 px-3 py-2 text-xs font-semibold dark:text-white"
            >
              <FileUp className="h-4 w-4" />
              Upload
            </button>
          </div>

          {assetsLoading ? (
            <div className="mt-3 text-sm text-slate-400">Lade…</div>
          ) : filteredAssets.length === 0 ? (
            <div className="mt-3 text-sm text-slate-400">Keine Assets in dieser Ansicht.</div>
          ) : (
            <ul className="mt-4 space-y-2">
              {filteredAssets.map((a) => (
                <AssetItem
                  key={a.id}
                  asset={a}
                  folderLabel={a.folderId ? folderNameById.get(a.folderId) ?? '—' : '(Root)'}
                  exerciseStatus={a.type === 'exercise' ? exerciseStatusByAssetId[a.id] : undefined}
                  onOpen={() => void openAsset(a)}
                  onDownload={() => void downloadAsset(a)}
                  onDelete={() => {
                    if (window.confirm(`Asset „${a.title}“ löschen?`)) {
                      void deleteAsset(a.id, topicId);
                    }
                  }}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      <UploadAssetModal
        open={uploadOpen}
        file={uploadFile}
        initialType={uploadType}
        folders={folders}
        onClose={() => setUploadOpen(false)}
        onSubmit={async (input) => {
          if (!input.file) return;
          try {
            await createWithFile({
              subjectId,
              topicId,
              folderId: input.folderId,
              type: input.type,
              title: input.title,
              file: input.file,
            });
          } finally {
            setUploadFile(null);
          }
        }}
      />
    </div>
  );
}
