import { formatDuration } from '../../../utils/time';
import type { SessionDayStat } from '../sessionDayStats';

export function SessionTimeBarChart7(props: { days: SessionDayStat[] }) {
  const { days } = props;
  const maxMs = Math.max(0, ...days.map((day) => day.totalMs));

  return (
    <section className="rounded-2xl w-full border border-white/2 bg-white/2 p-4">
      <div>
        <h2 className="text-sm font-semibold text-white">Sessionzeit (7 Tage)</h2>
        <p className="mt-1 text-xs text-white/50">
          Die Balkenhöhe entspricht der gesamten Sessionzeit pro Tag.
        </p>
      </div>

      <div className="mt-5 flex gap-3">
        {days.map((day) => {
          const heightPercent = maxMs > 0 ? Math.max((day.totalMs / maxMs) * 100, 6) : 6;
          const valueLabel = formatDuration(Math.round(day.totalMs / 1000), true);
          return (
            <div key={day.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="text-[11px] text-white/50">{valueLabel}</div>
              <div className="relative h-40 w-full">
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-t-md bg-white/50 transition-[height] duration-300"
                  style={{ height: `${heightPercent}%` }}
                  title={`${day.fullLabel}: ${valueLabel}`}
                  aria-label={`${day.fullLabel}: ${valueLabel}`}
                />
              </div>
              <div className="text-center text-[11px] text-slate-400">
                <div className="font-medium text-slate-300">{day.weekdayShort}</div>
                <div>{day.shortLabel}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
