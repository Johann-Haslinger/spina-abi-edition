import { useEffect, useMemo, useState } from 'react';
import type { PlannedItem, PlannedItemType, WeeklyRecurrence, Topic } from '../../../domain/models';
import { Modal } from '../../../components/Modal';
import { useSubjectsStore } from '../../../stores/subjectsStore';
import { useTopicsStore } from '../../../stores/topicsStore';

import type { PlannedItemCreateInput as RepoPlannedItemCreateInput } from '../../../repositories/planning/interfaces';

// Note: We intentionally keep validation lightweight (v1).

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toDatetimeLocalValue(ms: number): string {
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const MM = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
}

function parseDatetimeLocalValue(v: string): number | undefined {
  if (!v) return undefined;
  const ms = new Date(v).getTime();
  if (!Number.isFinite(ms)) return undefined;
  return ms;
}

function getDefaultDurationMinutes(type: PlannedItemType): number {
  return type === 'studySession' ? 90 : 60;
}

export function PlanningEventModal(props: {
  open: boolean;
  mode: 'create' | 'edit';
  plannedItem?: PlannedItem;

  initial?: {
    startAtMs?: number;
    durationMinutes?: number;
    type?: PlannedItemType;
  };

  onClose: () => void;
  onSave: (input: RepoPlannedItemCreateInput) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
}) {
  const { subjects, loading: subjectsLoading, refresh: refreshSubjects } = useSubjectsStore();
  const {
    topicsBySubject,
    loadingBySubject,
    errorBySubject,
    refreshBySubject,
  } = useTopicsStore();

  const defaultType: PlannedItemType = props.initial?.type ?? props.plannedItem?.type ?? 'studySession';

  const [type, setType] = useState<PlannedItemType>(defaultType);
  const [title, setTitle] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');

  const [startAtValue, setStartAtValue] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState<string>(
    String(getDefaultDurationMinutes(defaultType)),
  );

  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [repeatEndKind, setRepeatEndKind] = useState<'untilAt' | 'occurrenceCount'>('untilAt');
  const [repeatUntilAtValue, setRepeatUntilAtValue] = useState<string>('');
  const [repeatOccurrenceCount, setRepeatOccurrenceCount] = useState<string>('10');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topics: Topic[] = selectedSubjectId ? topicsBySubject[selectedSubjectId] ?? [] : [];
  const topicsLoading = selectedSubjectId ? loadingBySubject[selectedSubjectId] ?? false : false;
  const topicsError = selectedSubjectId ? errorBySubject[selectedSubjectId] : undefined;

  useEffect(() => {
    if (!props.open) return;
    void refreshSubjects();
  }, [props.open, refreshSubjects]);

  useEffect(() => {
    if (!props.open) return;
    const item = props.plannedItem;
    const initialStartAt = props.initial?.startAtMs;
    const initialDuration = props.initial?.durationMinutes;

    if (item) {
      setType(item.type);
      setTitle(item.title ?? '');
      setSelectedSubjectId(item.subjectId ?? '');
      setSelectedTopicId(item.topicId ?? '');
      setStartAtValue(toDatetimeLocalValue(item.startAtMs));
      setDurationMinutes(String(Math.max(1, Math.round(item.durationMs / 60_000))));

      const recurrence = item.recurrence;
      if (recurrence?.kind === 'weekly') {
        setRepeatWeekly(true);
        if (recurrence.untilAtMs !== undefined) {
          setRepeatEndKind('untilAt');
          setRepeatUntilAtValue(toDatetimeLocalValue(recurrence.untilAtMs));
        } else {
          setRepeatEndKind('occurrenceCount');
          setRepeatUntilAtValue('');
        }
        setRepeatOccurrenceCount(String(recurrence.occurrenceCount ?? 10));
      } else {
        setRepeatWeekly(false);
        setRepeatEndKind('untilAt');
        setRepeatUntilAtValue('');
        setRepeatOccurrenceCount('10');
      }
    } else {
      setType(defaultType);
      setTitle('');

      setSelectedSubjectId('');
      setSelectedTopicId('');

      const startAt = initialStartAt ?? Date.now();
      const rounded = Math.ceil(startAt / (30 * 60_000)) * (30 * 60_000);
      setStartAtValue(toDatetimeLocalValue(rounded));
      setDurationMinutes(String(initialDuration ?? getDefaultDurationMinutes(defaultType)));

      setRepeatWeekly(false);
      setRepeatEndKind('untilAt');
      setRepeatUntilAtValue('');
      setRepeatOccurrenceCount('10');
    }

    setSaving(false);
    setError(null);
  }, [
    props.open,
    props.plannedItem,
    props.initial?.startAtMs,
    props.initial?.durationMinutes,
    props.initial?.type,
    defaultType,
  ]);

  useEffect(() => {
    if (!props.open) return;
    if (!selectedSubjectId) return;
    void refreshBySubject(selectedSubjectId);
  }, [props.open, selectedSubjectId, refreshBySubject]);

  const durationMs = useMemo(() => {
    const trimmed = durationMinutes.trim();
    if (!trimmed) return undefined;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n <= 0) return undefined;
    return Math.round(n * 60_000);
  }, [durationMinutes]);

  const startAtMs = useMemo(() => parseDatetimeLocalValue(startAtValue), [startAtValue]);

  const recurrence: WeeklyRecurrence | undefined = useMemo(() => {
    if (!repeatWeekly) return undefined;
    const untilAtMs = repeatEndKind === 'untilAt' ? parseDatetimeLocalValue(repeatUntilAtValue) : undefined;
    const occurrenceCount =
      repeatEndKind === 'occurrenceCount' ? Number(repeatOccurrenceCount.trim()) : undefined;

    if (repeatEndKind === 'untilAt') {
      if (untilAtMs === undefined) return undefined;
      return { kind: 'weekly', intervalWeeks: 1, untilAtMs };
    }

    if (occurrenceCount === undefined || !Number.isFinite(occurrenceCount) || occurrenceCount <= 0) {
      return undefined;
    }
    return { kind: 'weekly', intervalWeeks: 1, occurrenceCount: Math.floor(occurrenceCount) };
  }, [repeatWeekly, repeatEndKind, repeatUntilAtValue, repeatOccurrenceCount]);

  const canSave = useMemo(() => {
    if (!startAtMs || durationMs === undefined) return false;
    if (type === 'event') {
      if (!title.trim()) return false;
    }
    if (type === 'studySession') {
      if (!selectedTopicId) return false;
    }
    if (repeatWeekly && recurrence === undefined) return false;
    return true;
  }, [durationMs, startAtMs, type, title, selectedTopicId, repeatWeekly, recurrence]);

  async function submit() {
    setError(null);
    if (!canSave || !startAtMs || durationMs === undefined) return;

    const input: RepoPlannedItemCreateInput = {
      type,
      startAtMs,
      durationMs,
      recurrence,
      subjectId: type === 'studySession' ? selectedSubjectId : undefined,
      topicId: type === 'studySession' ? selectedTopicId : undefined,
      title: type === 'event' ? title.trim() : undefined,
    };

    setSaving(true);
    try {
      await props.onSave(input);
      props.onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          {props.mode === 'edit' && props.onDelete ? (
            <button
              type="button"
              onClick={() => void props.onDelete?.()}
              className="rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
              disabled={saving}
            >
              Löschen
            </button>
          ) : (
            <span />
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={props.onClose}
              className="rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-50 hover:bg-slate-700"
              disabled={saving}
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!canSave || saving}
              className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
            >
              {props.mode === 'edit' ? 'Speichern' : 'Anlegen'}
            </button>
          </div>
        </div>
      }
    >
      {error ? (
        <div className="mb-3 rounded-md border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="space-y-4">
        <label className="block">
          <div className="text-xs font-semibold text-slate-300">Typ</div>
          <select
            value={type}
            onChange={(e) => {
              const nextType = e.target.value as PlannedItemType;
              setType(nextType);
              if (props.mode === 'create' && !props.plannedItem) {
                setDurationMinutes(String(getDefaultDurationMinutes(nextType)));
              }
            }}
            disabled={props.mode === 'edit'}
            className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none ring-indigo-500/30 focus:ring-2"
          >
            <option value="studySession">Lern-Session</option>
            <option value="event">Event</option>
          </select>
        </label>

        {type === 'event' ? (
          <label className="block">
            <div className="text-xs font-semibold text-slate-300">Titel</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z.B. Theorie wiederholen"
              className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none ring-indigo-500/30 focus:ring-2"
            />
          </label>
        ) : (
          <>
            <label className="block">
              <div className="text-xs font-semibold text-slate-300">Fach</div>
              <select
                value={selectedSubjectId}
                onChange={(e) => {
                  setSelectedSubjectId(e.target.value);
                  setSelectedTopicId('');
                }}
                disabled={subjectsLoading}
                className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none ring-indigo-500/30 focus:ring-2"
              >
                <option value="" disabled>
                  {subjectsLoading ? 'Lade…' : 'Bitte wählen'}
                </option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.iconEmoji ? `${s.iconEmoji} ` : ''}
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="text-xs font-semibold text-slate-300">Thema</div>
              <select
                value={selectedTopicId}
                onChange={(e) => setSelectedTopicId(e.target.value)}
                disabled={!selectedSubjectId || topicsLoading}
                className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none ring-indigo-500/30 focus:ring-2"
              >
                <option value="" disabled>
                  {!selectedSubjectId ? 'Erst Fach wählen' : topicsLoading ? 'Lade…' : 'Bitte wählen'}
                </option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.iconEmoji ? `${t.iconEmoji} ` : ''}
                    {t.name}
                  </option>
                ))}
              </select>
              {topicsError ? <div className="mt-2 text-xs text-rose-200">{topicsError}</div> : null}
            </label>
          </>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block">
            <div className="text-xs font-semibold text-slate-300">Start</div>
            <input
              type="datetime-local"
              value={startAtValue}
              onChange={(e) => setStartAtValue(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none ring-indigo-500/30 focus:ring-2"
            />
          </label>

          <label className="block">
            <div className="text-xs font-semibold text-slate-300">Dauer (Minuten)</div>
            <input
              inputMode="numeric"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none ring-indigo-500/30 focus:ring-2"
            />
          </label>
        </div>

        <div className="border border-slate-800/60 rounded-md p-3">
          <label className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-300">Wiederholen</span>
            <input
              type="checkbox"
              checked={repeatWeekly}
              onChange={(e) => setRepeatWeekly(e.target.checked)}
              className="h-4 w-4 accent-indigo-500"
            />
          </label>

          {repeatWeekly ? (
            <div className="mt-3 space-y-3">
              <label className="block">
                <div className="text-xs font-semibold text-slate-300">Ende</div>
                <select
                  value={repeatEndKind}
                  onChange={(e) => setRepeatEndKind(e.target.value as 'untilAt' | 'occurrenceCount')}
                  className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none ring-indigo-500/30 focus:ring-2"
                >
                  <option value="untilAt">Bis Datum</option>
                  <option value="occurrenceCount">Anzahl Vorkommen</option>
                </select>
              </label>

              {repeatEndKind === 'untilAt' ? (
                <label className="block">
                  <div className="text-xs font-semibold text-slate-300">Bis (letzter Start)</div>
                  <input
                    type="datetime-local"
                    value={repeatUntilAtValue}
                    onChange={(e) => setRepeatUntilAtValue(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none ring-indigo-500/30 focus:ring-2"
                  />
                </label>
              ) : (
                <label className="block">
                  <div className="text-xs font-semibold text-slate-300">Anzahl</div>
                  <input
                    inputMode="numeric"
                    value={repeatOccurrenceCount}
                    onChange={(e) => setRepeatOccurrenceCount(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none ring-indigo-500/30 focus:ring-2"
                  />
                </label>
              )}
            </div>
          ) : (
            <div className="mt-2 text-xs text-slate-400">Kein Wiederholen.</div>
          )}
        </div>
      </div>
    </Modal>
  );
}

