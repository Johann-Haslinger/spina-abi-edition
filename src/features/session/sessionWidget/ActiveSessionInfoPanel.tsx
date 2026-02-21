import { Pause, Play, Plus, Square } from 'lucide-react';
import type { ActiveSession } from '../../../stores/activeSessionStore';
import { useActiveSessionStore } from '../../../stores/activeSessionStore';
import { formatDurationClock } from '../../../utils/time';

export function ActiveSessionInfoPanel(props: {
  open: boolean;
  active: ActiveSession;
  subjectName?: string;
  topicName?: string;
  elapsedSeconds: number;
  onStop: () => void | Promise<void>;
}) {
  const { togglePause, extendPlannedDurationMs, setPlannedDurationMs } = useActiveSessionStore();

  return (
    <div
      className={[
        'rounded-xl border bg-[#243957]/70 backdrop-blur shadow-lg dark:border-white/5',
        'transition-all duration-200 ease-out',
        props.open ? 'mt-2 max-h-96 opacity-100' : 'pointer-events-none mt-0 max-h-0 opacity-0',
      ].join(' ')}
    >
      <div className="px-3 py-3">
        <div className="space-y-3">
          <div className="text-xs text-slate-400">
            <span className="font-semibold text-slate-200">
              {props.subjectName ?? props.active.subjectId}
            </span>
            {' · '}
            <span className="font-semibold text-slate-200">
              {props.topicName ?? props.active.topicId}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={togglePause}
              className="inline-flex items-center gap-2 rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-50 hover:bg-slate-700"
            >
              {props.active.pausedAtMs ? (
                <Play className="h-4 w-4" />
              ) : (
                <Pause className="h-4 w-4" />
              )}
              {props.active.pausedAtMs ? 'Fortsetzen' : 'Pausieren'}
            </button>

            <button
              type="button"
              onClick={() => void props.onStop?.()}
              className="inline-flex items-center gap-2 rounded-md bg-red-700/80 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
              title="Session beenden"
            >
              <Square className="h-4 w-4" />
              Beenden
            </button>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => extendPlannedDurationMs(5 * 60_000)}
                className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-50 hover:bg-slate-700"
                title="Geplante Dauer verlängern"
              >
                <Plus className="h-4 w-4" />
                5m
              </button>
              <button
                type="button"
                onClick={() => extendPlannedDurationMs(10 * 60_000)}
                className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-50 hover:bg-slate-700"
                title="Geplante Dauer verlängern"
              >
                <Plus className="h-4 w-4" />
                10m
              </button>
              <button
                type="button"
                onClick={() => extendPlannedDurationMs(15 * 60_000)}
                className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-50 hover:bg-slate-700"
                title="Geplante Dauer verlängern"
              >
                <Plus className="h-4 w-4" />
                15m
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="rounded bg-slate-900/60 px-2 py-1">
              Laufzeit: {formatDurationClock(props.elapsedSeconds)}
            </span>
            <span className="rounded bg-slate-900/60 px-2 py-1">
              Erwartet:{' '}
              {props.active.plannedDurationMs
                ? formatDurationClock(Math.round(props.active.plannedDurationMs / 1000))
                : '—'}
            </span>
            {props.active.plannedDurationMs ? (
              <button
                type="button"
                onClick={() => setPlannedDurationMs(undefined)}
                className="ml-auto rounded-md bg-slate-900/60 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-900"
                title="Geplante Dauer entfernen"
              >
                Erwartung löschen
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
