import { useEffect, useMemo, useRef, useState } from 'react';
import { IoChevronBack } from 'react-icons/io5';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { GhostButton } from '../../../components/Button';
import { Modal } from '../../../components/Modal';
import { PageHeader } from '../../../components/PageHeader';
import { ViewerIconButton } from '../../../components/ViewerIconButton';
import type { Topic } from '../../../domain/models';
import { requirementRepo, scheduledReviewRepo } from '../../../repositories';
import { useActiveSessionStore } from '../../../stores/activeSessionStore';
import { useCurriculumStore } from '../../../stores/curriculumStore';
import { useNotificationsStore } from '../../../stores/notificationsStore';
import { useSubjectsStore } from '../../../stores/subjectsStore';
import { useTopicsStore } from '../../../stores/topicsStore';
import { NotFoundPage } from '../../common/NotFoundPage';
import { TopicItem } from './components/TopicItem';
import { UpsertTopicModal } from './modals/UpsertTopicModal';

const EMPTY_TOPICS: Topic[] = [];

export function SubjectPage() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const active = useActiveSessionStore((state) => state.active);
  const start = useActiveSessionStore((state) => state.start);
  const pushNotification = useNotificationsStore((state) => state.push);
  const from = (location.state as { from?: string } | null)?.from;

  const subjects = useSubjectsStore((state) => state.subjects);
  const subjectsLoading = useSubjectsStore((state) => state.loading);
  const refreshSubjects = useSubjectsStore((state) => state.refresh);
  const topicsBySubject = useTopicsStore((state) => state.topicsBySubject);
  const loadingBySubject = useTopicsStore((state) => state.loadingBySubject);
  const errorBySubject = useTopicsStore((state) => state.errorBySubject);
  const refreshBySubject = useTopicsStore((state) => state.refreshBySubject);
  const createTopic = useTopicsStore((state) => state.createTopic);
  const renameTopic = useTopicsStore((state) => state.renameTopic);
  const deleteTopic = useTopicsStore((state) => state.deleteTopic);

  const refreshSubjectDocuments = useCurriculumStore((state) => state.refreshSubjectDocuments);
  const importCurriculum = useCurriculumStore((state) => state.importCurriculum);

  useEffect(() => {
    void refreshSubjects();
  }, [refreshSubjects]);

  useEffect(() => {
    if (subjectId) void refreshBySubject(subjectId);
  }, [refreshBySubject, subjectId]);

  useEffect(() => {
    if (subjectId) void refreshSubjectDocuments(subjectId);
  }, [refreshSubjectDocuments, subjectId]);

  const subject = useMemo(() => subjects.find((s) => s.id === subjectId), [subjects, subjectId]);
  const topics = subjectId ? (topicsBySubject[subjectId] ?? EMPTY_TOPICS) : EMPTY_TOPICS;
  const topicsLoading = subjectId ? (loadingBySubject[subjectId] ?? false) : false;
  const topicsError = subjectId ? errorBySubject[subjectId] : undefined;

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Topic | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [curriculumFile, setCurriculumFile] = useState<File | null>(null);
  const [desiredTopicNamesText, setDesiredTopicNamesText] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const goBack = () => {
    if (from) {
      navigate(from);
    } else {
      navigate('/dashboard');
    }
  };

  if (!subjectId) return <NotFoundPage />;
  if (!subjectsLoading && !subject) return <NotFoundPage />;

  return (
    <div className="space-y-4 p-6">
      <ViewerIconButton ariaLabel="Zurück" onClick={goBack} className="fixed left-6 top-6">
        <IoChevronBack />
      </ViewerIconButton>

      <PageHeader
        title={
          subject ? `${subject.iconEmoji ? subject.iconEmoji + ' ' : ''}${subject.name}` : 'Fach'
        }
        actions={
          <div className="flex items-center gap-2">
            <GhostButton onClick={() => fileInputRef.current?.click()} className="text-sm">
              Lehrplan hochladen
            </GhostButton>
            <GhostButton
              onClick={async () => {
                const due = await scheduledReviewRepo.listDueBySubject(subjectId, Date.now());
                if (!due.length) {
                  pushNotification({
                    tone: 'info',
                    title: 'Keine Wiederholung fällig',
                    message: 'Fällige Aufgaben erscheinen hier automatisch.',
                  });
                  return;
                }
                const ranked = await Promise.all(
                  due.map(async (entry) => ({
                    entry,
                    mastery: entry.requirementId
                      ? ((await requirementRepo.get(entry.requirementId))?.mastery ?? 1)
                      : 1,
                  })),
                );
                ranked.sort((a, b) => a.mastery - b.mastery || a.entry.dueAtMs - b.entry.dueAtMs);
                const next = ranked[0].entry;
                if (
                  active &&
                  (active.subjectId !== subjectId || active.topicId !== next.topicId) &&
                  !window.confirm('Es läuft bereits eine Session. Für die Wiederholung wechseln?')
                ) {
                  return;
                }
                start({ subjectId, topicId: next.topicId });
                navigate(`/study/${next.assetId}`);
              }}
              className="text-sm"
            >
              Wiederholung starten
            </GhostButton>
            <button
              type="button"
              onClick={() => {
                setCreateOpen(true);
              }}
              className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
            >
              Thema anlegen
            </button>
          </div>
        }
      />

      {subjectsLoading || topicsLoading ? (
        <div className="mt-3 text-sm text-slate-400">Lade…</div>
      ) : (
        <>
          {topicsError ? (
            <div className="mt-3 rounded-md border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
              {topicsError}
            </div>
          ) : null}

          {topics.length === 0 ? (
            <div className="mt-4 text-sm text-slate-400">
              Noch keine Themen. Lege z.B. „Analysis“, „Stochastik“, „Vektoren“ an.
            </div>
          ) : (
            <ul className="grid grid-cols-4 gap-4">
              {topics.map((t) => (
                <TopicItem
                  key={t.id}
                  subjectId={subjectId}
                  topic={t}
                  from={from}
                  onEdit={(topic) => {
                    setEditing(topic);
                    setEditOpen(true);
                  }}
                  onDelete={(topic) => {
                    if (
                      window.confirm(
                        `Thema „${topic.name}“ wirklich löschen? (Assets/Folder werden mit gelöscht)`,
                      )
                    ) {
                      void deleteTopic(topic.id, subjectId);
                    }
                  }}
                />
              ))}
            </ul>
          )}
        </>
      )}

      <UpsertTopicModal
        open={createOpen}
        mode="create"
        onClose={() => setCreateOpen(false)}
        onSave={async (input) => {
          await createTopic({ subjectId, ...input });
        }}
      />

      <UpsertTopicModal
        open={editOpen}
        mode="edit"
        initial={editing ? { name: editing.name, iconEmoji: editing.iconEmoji } : undefined}
        onClose={() => setEditOpen(false)}
        onSave={async (input) => {
          if (!editing) return;
          await renameTopic(editing.id, subjectId, input);
        }}
      />

      <Modal
        open={importOpen}
        onClose={() => {
          if (importing) return;
          setImportOpen(false);
          setCurriculumFile(null);
          setDesiredTopicNamesText('');
        }}
        footer={
          <>
            <GhostButton
              onClick={() => {
                if (importing) return;
                setImportOpen(false);
                setCurriculumFile(null);
                setDesiredTopicNamesText('');
              }}
              disabled={importing}
            >
              Abbrechen
            </GhostButton>
            <button
              type="button"
              disabled={importing || !curriculumFile}
              onClick={async () => {
                if (!curriculumFile) return;
                setImporting(true);
                try {
                  const desiredTopicNames = desiredTopicNamesText
                    .split(/[,\n;\r]+/g)
                    .map((s) => s.trim())
                    .filter(Boolean);
                  await importCurriculum({
                    subjectId,
                    file: curriculumFile,
                    desiredTopicNames: desiredTopicNames.length ? desiredTopicNames : undefined,
                  });
                  await refreshBySubject(subjectId);
                  pushNotification({
                    tone: 'success',
                    title: 'Lehrplan importiert',
                    message: 'Die Themenstruktur wurde vollständig ersetzt.',
                  });
                  setImportOpen(false);
                  setCurriculumFile(null);
                  setDesiredTopicNamesText('');
                } catch (error) {
                  pushNotification({
                    tone: 'error',
                    title: 'Import fehlgeschlagen',
                    message: error instanceof Error ? error.message : 'Unbekannter Fehler',
                  });
                } finally {
                  setImporting(false);
                }
              }}
              className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
            >
              {importing ? 'Importiere…' : 'Import starten'}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-sm text-slate-300">
          <div className="text-lg font-semibold text-white">Lehrplan importieren</div>
          <p>
            Der Import ersetzt alle bestehenden Topics dieses Fachs inklusive ihrer Assets durch die
            neue KI-generierte Struktur.
          </p>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white/80">
            Datei: {curriculumFile?.name ?? 'Keine Datei gewählt'}
          </div>

          <div className="space-y-1">
            <div className="text-white/80">
              Gewuenschte Themen (optional, Komma-/Zeilen-getrennt)
            </div>
            <textarea
              value={desiredTopicNamesText}
              onChange={(e) => setDesiredTopicNamesText(e.target.value)}
              rows={3}
              placeholder="z.B. Analysis, Stochastik, Vektoren"
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white/90 outline-none placeholder:text-white/50"
            />
          </div>
        </div>
      </Modal>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.md"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          event.currentTarget.value = '';
          if (!file) return;
          setCurriculumFile(file);
          setDesiredTopicNamesText('');
          setImportOpen(true);
        }}
      />
    </div>
  );
}
