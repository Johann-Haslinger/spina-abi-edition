import { useEffect, useMemo, useState } from 'react';
import { IoChevronBack } from 'react-icons/io5';
import { useLocation, useNavigate } from 'react-router-dom';
import { ViewerIconButton } from '../../../components/ViewerIconButton';
import { db } from '../../../db/db';
import type { PlannedItem, PlannedItemType, StudySession, Topic } from '../../../domain/models';
import { plannedItemRepo } from '../../../repositories';
import type { PlannedItemCreateInput as RepoPlannedItemCreateInput } from '../../../repositories/planning/interfaces';
import { useSubjectsStore } from '../../../stores/subjectsStore';
import { useThemeStore } from '../../../stores/themeStore';
import { useTopicsStore } from '../../../stores/topicsStore';
import { resolveSubjectHex } from '../../../ui/subjectColorResolvers';
import { PlanningEntryDetailsModal } from '../components/PlanningEntryDetailsModal';
import { PlanningEventModal } from '../components/PlanningEventModal';
import { WeekCalendar } from '../components/WeekCalendar';
import { deleteStudySessionCascade } from '../utils/deleteStudySessionCascade';
import {
  addDaysMs,
  expandPlannedItemOccurrences,
  startOfWeekMs,
  toCalendarEntriesFromStudySession,
  type CalendarEntry,
} from '../utils/planning';

const DAYS_IN_WEEK = 7;

export function PlanningPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const goBack = () => {
    if (from) {
      navigate(from);
    } else {
      navigate('/dashboard');
    }
  };

  const [weekOffset, setWeekOffset] = useState(0);
  const nowMs = useMemo(() => Date.now(), []);
  const [createInitialType, setCreateInitialType] = useState<PlannedItemType>('studySession');
  const [createStartAtMs, setCreateStartAtMs] = useState<number | undefined>(undefined);
  const [createDurationMinutes, setCreateDurationMinutes] = useState<number | undefined>(undefined);
  const weekStartMs = useMemo(
    () => addDaysMs(startOfWeekMs(nowMs), weekOffset * DAYS_IN_WEEK),
    [weekOffset, nowMs],
  );
  const weekEndMs = useMemo(() => addDaysMs(weekStartMs, DAYS_IN_WEEK), [weekStartMs]);
  const createModalInitial = useMemo(
    () => ({
      startAtMs: createStartAtMs ?? Math.ceil(nowMs / (30 * 60_000)) * (30 * 60_000),
      durationMinutes:
        createDurationMinutes ?? (createInitialType === 'studySession' ? 90 : 60),
      type: createInitialType,
    }),
    [nowMs, createInitialType, createStartAtMs, createDurationMinutes],
  );

  const isPastWeek = weekEndMs <= nowMs;

  const [loading, setLoading] = useState(false);
  const [plannedBases, setPlannedBases] = useState<PlannedItem[]>([]);
  const [pastSessions, setPastSessions] = useState<StudySession[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<PlannedItem | undefined>(undefined);
  const [detailsEntry, setDetailsEntry] = useState<CalendarEntry | undefined>(undefined);

  const { subjects, refresh: refreshSubjects } = useSubjectsStore();
  const { topicsBySubject, refreshBySubject } = useTopicsStore();
  const theme = useThemeStore((s) => s.effectiveTheme);

  useEffect(() => {
    void refreshSubjects();
  }, [refreshSubjects]);

  useEffect(() => {
    if (subjects.length === 0) return;
    void Promise.all(subjects.map((s) => refreshBySubject(s.id)));
  }, [subjects, refreshBySubject]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [bases, candidates] = await Promise.all([
          plannedItemRepo.listPotentiallyOverlappingRange(weekStartMs, weekEndMs),
          db.studySessions.where('startedAtMs').below(weekEndMs).toArray(),
        ]);

        const endedSessions = candidates.filter((s) => {
          if (s.endedAtMs === undefined) return false;
          if (s.endedAtMs >= nowMs) return false;
          return s.startedAtMs < weekEndMs && s.endedAtMs > weekStartMs;
        });

        if (!cancelled) setPlannedBases(bases);
        if (!cancelled) setPastSessions(endedSessions);
      } catch {
        if (cancelled) return;
        setPlannedBases([]);
        setPastSessions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [weekEndMs, weekStartMs, nowMs, reloadKey]);

  const subjectAccentById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of subjects) {
      map.set(s.id, resolveSubjectHex(s.color, theme));
    }
    return map;
  }, [subjects, theme]);

  const topicById = useMemo(() => {
    const map = new Map<string, Topic>();
    for (const list of Object.values(topicsBySubject)) {
      for (const t of list) map.set(t.id, t);
    }
    return map;
  }, [topicsBySubject]);

  const subjectById = useMemo(() => {
    const map = new Map(subjects.map((subject) => [subject.id, subject]));
    return map;
  }, [subjects]);

  const entries: CalendarEntry[] = useMemo(() => {
    const out: CalendarEntry[] = [];

    for (const s of pastSessions) {
      if (s.endedAtMs === undefined) continue;
      const topic = topicById.get(s.topicId);
      const topicTitle = topic
        ? `${topic.iconEmoji ? `${topic.iconEmoji} ` : ''}${topic.name}`
        : 'Unbekanntes Thema';
      const entry = toCalendarEntriesFromStudySession(s, topicTitle);
      const accentColor = entry.subjectId ? subjectAccentById.get(entry.subjectId) : undefined;
      out.push({ ...entry, accentColor });
    }

    for (const base of plannedBases) {
      if (base.type === 'studySession') {
        const topic = base.topicId ? topicById.get(base.topicId) : undefined;
        const topicTitle = topic
          ? `${topic.iconEmoji ? `${topic.iconEmoji} ` : ''}${topic.name}`
          : 'Unbekanntes Thema';
        const subjectId = base.subjectId ?? topic?.subjectId;
        const accentColor = subjectId ? subjectAccentById.get(subjectId) : undefined;

        const occs = expandPlannedItemOccurrences(base, weekStartMs, weekEndMs);
        for (const occ of occs) {
          const occEnd = occ.startAtMs + occ.durationMs;
          if (occEnd <= nowMs) continue;

          out.push({
            id: base.id,
            source: 'planned',
            type: 'studySession',
            title: topicTitle,
            subjectId,
            topicId: base.topicId,
            startAtMs: occ.startAtMs,
            durationMs: occ.durationMs,
            accentColor,
          });
        }
      } else {
        const title = base.title ?? '(Ohne Titel)';
        const occs = expandPlannedItemOccurrences(base, weekStartMs, weekEndMs);
        for (const occ of occs) {
          const occEnd = occ.startAtMs + occ.durationMs;
          if (occEnd <= nowMs) continue;

          out.push({
            id: base.id,
            source: 'planned',
            type: 'event',
            title,
            startAtMs: occ.startAtMs,
            durationMs: occ.durationMs,
          });
        }
      }
    }

    out.sort((a, b) => a.startAtMs - b.startAtMs);
    return out;
  }, [pastSessions, plannedBases, topicById, subjectAccentById, weekEndMs, weekStartMs, nowMs]);

  return (
    <div className="flex flex-col overflow-hidden pt-20" style={{ height: '100dvh' }}>
      <ViewerIconButton ariaLabel="Zurück" onClick={goBack} className="fixed left-6 top-6">
        <IoChevronBack />
      </ViewerIconButton>

      <div className="flex items-start justify-between gap-3 pb-4">
        <button
          type="button"
          onClick={() => {
            setModalMode('create');
            setEditingItem(undefined);
            setCreateInitialType('studySession');
            setCreateStartAtMs(undefined);
            setCreateDurationMinutes(undefined);
            setDetailsEntry(undefined);
            setModalOpen(true);
          }}
          className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
          disabled={isPastWeek}
        >
          Eintrag hinzufügen
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-50 hover:bg-slate-700"
            onClick={() => setWeekOffset((x) => x - 1)}
          >
            Vorherige Woche
          </button>
          <button
            type="button"
            className="rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-50 hover:bg-slate-700"
            onClick={() => setWeekOffset((x) => x + 1)}
          >
            Nächste Woche
          </button>
        </div>
      </div>

      {loading ? <div className="pb-3 text-sm text-slate-400">Lade…</div> : null}

      <div className="min-h-0 flex-1 overflow-hidden">
        <WeekCalendar
          weekStartMs={weekStartMs}
          entries={entries}
          onEntryClick={(entry) => {
            setDetailsEntry(entry);
          }}
          onCreateRange={(startAtMs, durationMs) => {
            setModalMode('create');
            setEditingItem(undefined);
            setCreateInitialType('studySession');
            setCreateStartAtMs(startAtMs);
            setCreateDurationMinutes(Math.max(30, Math.round(durationMs / 60_000)));
            setDetailsEntry(undefined);
            setModalOpen(true);
          }}
          onPlannedEntryChange={async (entry, patch) => {
            const base =
              plannedBases.find((item) => item.id === entry.id) ??
              (await plannedItemRepo.get(entry.id));
            if (!base) return;

            const nextPatch: {
              startAtMs?: number;
              durationMs?: number;
            } = {};

            if (patch.startAtMs !== undefined) {
              const deltaMs = patch.startAtMs - entry.startAtMs;
              nextPatch.startAtMs = base.startAtMs + deltaMs;
            }

            if (patch.durationMs !== undefined) {
              nextPatch.durationMs = patch.durationMs;
            }

            setDetailsEntry(undefined);
            await plannedItemRepo.update(base.id, nextPatch);
            setReloadKey((k) => k + 1);
          }}
        />
      </div>

      <PlanningEventModal
        open={modalOpen}
        mode={modalMode}
        plannedItem={editingItem}
        initial={createModalInitial}
        onClose={() => {
          setModalOpen(false);
          setCreateStartAtMs(undefined);
          setCreateDurationMinutes(undefined);
        }}
        onSave={async (input: RepoPlannedItemCreateInput) => {
          if (modalMode === 'create') {
            await plannedItemRepo.create(input);
          } else {
            if (!editingItem) return;
            await plannedItemRepo.update(editingItem.id, input);
          }
          setModalOpen(false);
          setCreateStartAtMs(undefined);
          setCreateDurationMinutes(undefined);
          setReloadKey((k) => k + 1);
        }}
        onDelete={
          modalMode === 'edit' && editingItem
            ? async () => {
                const ok = window.confirm('Geplanten Eintrag wirklich löschen?');
                if (!ok) return;
                await plannedItemRepo.delete(editingItem.id);
                setModalOpen(false);
                setCreateStartAtMs(undefined);
                setCreateDurationMinutes(undefined);
                setReloadKey((k) => k + 1);
              }
            : undefined
        }
      />

      <PlanningEntryDetailsModal
        open={Boolean(detailsEntry)}
        entry={detailsEntry}
        subjectName={
          detailsEntry?.subjectId ? subjectById.get(detailsEntry.subjectId)?.name : undefined
        }
        topicName={detailsEntry?.topicId ? topicById.get(detailsEntry.topicId)?.name : undefined}
        onClose={() => setDetailsEntry(undefined)}
        onEdit={
          detailsEntry?.source === 'planned'
            ? async () => {
                const found = plannedBases.find((b) => b.id === detailsEntry.id);
                const item = found ?? (await plannedItemRepo.get(detailsEntry.id));
                if (!item) return;
                setDetailsEntry(undefined);
                setModalMode('edit');
                setEditingItem(item);
                setCreateStartAtMs(undefined);
                setCreateDurationMinutes(undefined);
                setModalOpen(true);
              }
            : undefined
        }
        onDelete={
          detailsEntry?.source === 'past'
            ? async () => {
                const ok = window.confirm(
                  'Diese vergangene Session wirklich löschen? Zugehörige Versuche und Notizen in dieser Session gehen verloren.',
                );
                if (!ok) return;
                await deleteStudySessionCascade(detailsEntry.id);
                setDetailsEntry(undefined);
                setReloadKey((k) => k + 1);
              }
            : undefined
        }
      />
    </div>
  );
}
