import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import type { StudySession, Subject } from '../../domain/models';
import { studySessionRepo } from '../../repositories';
import { useSubjectsStore } from '../../stores/subjectsStore';
import { SessionTimeBarChart7 } from './components/SessionTimeBarChart7';
import { SessionTimeHeatmap90 } from './components/SessionTimeHeatmap90';
import { SubjectItem } from './components/SubjectItem';
import { UpsertSubjectModal } from './modals/UpsertSubjectModal';
import { aggregateSessionMsByDay, buildRecentSessionDayStats } from './sessionDayStats';

export function DashboardPage() {
  const { subjects, loading, error, refresh, createSubject, updateSubject, deleteSubject } =
    useSubjectsStore();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [completedSessions, setCompletedSessions] = useState<StudySession[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSessions() {
      setStatsLoading(true);
      setStatsError(null);
      try {
        const sessions = await studySessionRepo.listAll();
        if (cancelled) return;
        setCompletedSessions(sessions.filter((session) => typeof session.endedAtMs === 'number'));
      } catch {
        if (cancelled) return;
        setCompletedSessions([]);
        setStatsError('Session-Statistiken konnten nicht geladen werden.');
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    }

    void loadSessions();
    return () => {
      cancelled = true;
    };
  }, []);

  const sessionMsByDay = useMemo(
    () => aggregateSessionMsByDay(completedSessions),
    [completedSessions],
  );
  const heatmapDays = useMemo(
    () => buildRecentSessionDayStats({ dayCount: 90, totalsByDay: sessionMsByDay }),
    [sessionMsByDay],
  );
  const barChartDays = useMemo(
    () => buildRecentSessionDayStats({ dayCount: 7, totalsByDay: sessionMsByDay }),
    [sessionMsByDay],
  );
  const sessionSourceStats = useMemo(() => {
    const learnPathSessions = completedSessions.filter((session) => session.source === 'learnpath').length;
    const exerciseSessions = completedSessions.filter((session) => session.source !== 'learnpath').length;
    return {
      total: completedSessions.length,
      learnPathSessions,
      exerciseSessions,
    };
  }, [completedSessions]);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(subject: Subject) {
    setEditing(subject);
    setModalOpen(true);
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Dashboard"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openCreate}
              className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
            >
              Fach anlegen
            </button>
            <Link
              to="/planning"
              className="rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-50 hover:bg-slate-700"
            >
              Session Planung
            </Link>
          </div>
        }
      />

      {error ? (
        <div className="mt-3 rounded-md border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-3 text-sm text-slate-400">Lade…</div>
      ) : subjects.length === 0 ? (
        <div className="mt-3 text-sm text-slate-400">
          Noch keine Fächer. Lege dein erstes Fach an (z.B. Mathe).
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
          {subjects.map((s) => (
            <SubjectItem
              key={s.id}
              subject={s}
              onEdit={openEdit}
              onDelete={async (subject) => {
                if (
                  !window.confirm(
                    `Fach „${subject.name}“ wirklich löschen? (Themen/Assets werden mit gelöscht)`,
                  )
                ) {
                  return;
                }
                await deleteSubject(subject.id);
              }}
            />
          ))}
        </ul>
      )}

      {statsError ? (
        <div className="rounded-md border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
          {statsError}
        </div>
      ) : statsLoading ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-6 text-sm text-slate-400">
          Lade Session-Statistiken…
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <StatCard label="Sessions gesamt" value={String(sessionSourceStats.total)} />
            <StatCard label="Learn Path" value={String(sessionSourceStats.learnPathSessions)} />
            <StatCard label="Übungen" value={String(sessionSourceStats.exerciseSessions)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SessionTimeHeatmap90 days={heatmapDays} />
            <SessionTimeBarChart7 days={barChartDays} />
          </div>
        </div>
      )}

      <UpsertSubjectModal
        open={modalOpen}
        mode={editing ? 'edit' : 'create'}
        subject={editing ?? undefined}
        initial={
          editing
            ? {
                name: editing.name,
                color: editing.color,
                iconEmoji: editing.iconEmoji,
              }
            : undefined
        }
        onClose={() => setModalOpen(false)}
        onSave={async (input) => {
          if (editing) {
            await updateSubject(editing.id, input);
          } else {
            await createSubject(input);
          }
        }}
        onDelete={
          editing
            ? async () => {
                await deleteSubject(editing.id);
              }
            : undefined
        }
      />
    </div>
  );
}

function StatCard(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-4">
      <div className="text-xs text-slate-400">{props.label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{props.value}</div>
    </div>
  );
}
