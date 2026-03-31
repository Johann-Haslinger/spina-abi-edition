import { Modal } from '../../../components/Modal';
import type { CalendarEntry } from '../utils/planning';
import { formatCalendarTimeRange } from '../utils/planning';

export function PlanningEntryDetailsModal(props: {
  open: boolean;
  entry?: CalendarEntry;
  subjectName?: string;
  topicName?: string;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void | Promise<void>;
}) {
  const { open, entry, subjectName, topicName, onClose, onEdit, onDelete } = props;

  return (
    <Modal
      open={open}
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <div>
            {entry?.source === 'past' && onDelete ? (
              <button
                type="button"
                onClick={() => void onDelete()}
                className="rounded-md bg-red-900/80 px-3 py-2 text-sm font-semibold text-red-50 hover:bg-red-800"
              >
                Löschen
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-50 hover:bg-slate-700"
            >
              Schließen
            </button>
            {entry?.source === 'planned' && onEdit ? (
              <button
                type="button"
                onClick={onEdit}
                className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
              >
                Bearbeiten
              </button>
            ) : null}
          </div>
        </div>
      }
    >
      {entry ? (
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {entry.source === 'past'
                ? 'Vergangene Session'
                : entry.type === 'event'
                  ? 'Geplantes Event'
                  : 'Geplante Session'}
            </div>
            <div className="mt-1 text-2xl font-semibold text-slate-50">{entry.title}</div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-3">
              <div className="text-xs font-semibold text-slate-400">Zeit</div>
              <div className="mt-1 text-sm text-slate-100">
                {formatCalendarTimeRange(entry.startAtMs, entry.durationMs)}
              </div>
            </div>

            <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-3">
              <div className="text-xs font-semibold text-slate-400">Datum</div>
              <div className="mt-1 text-sm text-slate-100">
                {new Intl.DateTimeFormat('de-DE', {
                  weekday: 'long',
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                }).format(new Date(entry.startAtMs))}
              </div>
            </div>
          </div>

          {entry.type !== 'event' ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-3">
                <div className="text-xs font-semibold text-slate-400">Fach</div>
                <div className="mt-1 text-sm text-slate-100">{subjectName ?? 'Unbekannt'}</div>
              </div>

              <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-3">
                <div className="text-xs font-semibold text-slate-400">Thema</div>
                <div className="mt-1 text-sm text-slate-100">{topicName ?? entry.title}</div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}

