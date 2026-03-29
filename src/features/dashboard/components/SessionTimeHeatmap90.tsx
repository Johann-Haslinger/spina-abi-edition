import { formatDuration } from '../../../utils/time';
import { getWeekdayMondayIndex, type SessionDayStat } from '../sessionDayStats';

const weekdayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function getHeatColor(totalMs: number, maxMs: number) {
  if (maxMs <= 0) return 'rgba(255, 255, 255, 0.02)';
  const ratio = Math.max(0, Math.min(1, totalMs / maxMs));
  const opacity = 0.05 + ratio * 0.95;
  return `rgba(255, 255, 255, ${opacity})`;
}

export function SessionTimeHeatmap90(props: { days: SessionDayStat[] }) {
  const { days } = props;
  const maxMs = Math.max(0, ...days.map((day) => day.totalMs));
  const leadingEmptyCellCount = days.length > 0 ? getWeekdayMondayIndex(days[0].dateMs) : 0;
  const cells: Array<SessionDayStat | null> = [
    ...Array.from({ length: leadingEmptyCellCount }, () => null),
    ...days,
  ];
  const trailingEmptyCellCount = (7 - (cells.length % 7 || 7)) % 7;
  cells.push(...Array.from({ length: trailingEmptyCellCount }, () => null));

  return (
    <section className="rounded-2xl w-full border border-white/2 bg-white/2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Sessionzeit (90 Tage)</h2>
          <p className="mt-1 text-xs text-white/50">
            Jeder Block zeigt die gesamte Sessionzeit eines Tages.
          </p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <div>Weniger</div>
          <div>Mehr</div>
        </div>
      </div>

      <div className="mt-4 grid grid-flow-col grid-rows-7 gap-2">
        {weekdayLabels.map((label) => (
          <div
            key={label}
            className="flex items-center justify-start text-[11px] font-medium uppercase text-slate-500"
          >
            {label}
          </div>
        ))}

        {cells.map((day, index) =>
          day ? (
            <div
              key={day.key}
              className="aspect-square rounded-md"
              style={{ backgroundColor: getHeatColor(day.totalMs, maxMs) }}
              title={`${day.fullLabel}: ${formatDuration(Math.round(day.totalMs / 1000), true)}`}
              aria-label={`${day.fullLabel}: ${formatDuration(Math.round(day.totalMs / 1000), true)}`}
            />
          ) : (
            <div key={`empty-${index}`} className="aspect-square" aria-hidden />
          ),
        )}
      </div>
    </section>
  );
}
