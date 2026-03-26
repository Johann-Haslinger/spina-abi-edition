import { useEffect, useState } from 'react';
import { IoClose } from 'react-icons/io5';
import type { AttemptAiReview } from '../../../domain/models';
import { attemptAiReviewRepo } from '../../../repositories';
import { useNotificationsStore } from '../../../stores/notificationsStore';

export function AiErrorReviewPanel(props: { attemptId: string | null; onClose: () => void }) {
  const [review, setReview] = useState<AttemptAiReview | null>(null);
  const setAttemptReviewPanelOpen = useNotificationsStore((s) => s.setAttemptReviewPanelOpen);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!props.attemptId) {
        setReview(null);
        return;
      }
      const loaded = await attemptAiReviewRepo.getByAttempt(props.attemptId);
      if (!cancelled) setReview(loaded ?? null);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [props.attemptId]);

  useEffect(() => {
    const visible = Boolean(props.attemptId && review);
    setAttemptReviewPanelOpen(visible);
    return () => {
      setAttemptReviewPanelOpen(false);
    };
  }, [props.attemptId, review, setAttemptReviewPanelOpen]);

  if (!props.attemptId || !review) return null;

  const resultLabel =
    review.result === 'correct'
      ? 'Richtig'
      : review.result === 'partial'
        ? 'Teilweise richtig'
        : 'Fehler erkannt';
  const resultTone =
    review.result === 'correct'
      ? 'border-emerald-500/15 bg-emerald-950/30 text-emerald-100'
      : review.result === 'partial'
        ? 'border-amber-500/15 bg-amber-950/30 text-amber-100'
        : 'border-rose-500/15 bg-rose-950/40 text-rose-100';

  return (
    <aside className="fixed h-96 overflow-y-auto right-6 top-4  z-10000000001 w-120 max-w-[calc(100vw-2rem)] rounded-4xl border border-white/10  bg-[#243957]/70 p-5 text-white shadow-lg backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-white/50">KI-Bewertung</div>
          <h2 className="mt-1 text-xl font-semibold">Attempt-Details</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div
            className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-semibold tabular-nums"
            title="Gesamt-Mastery-Delta"
          >
            {formatMasteryDeltaSum(review.requirementUpdates ?? [])}
          </div>
          <button type="button" onClick={props.onClose} className="rounded-full p-2 hover:bg-white/5">
            <IoClose className="text-xl" />
          </button>
        </div>
      </div>
      {review.messageToUser ? (
        <p className="mt-4 text-sm text-white/75 whitespace-pre-wrap">{review.messageToUser}</p>
      ) : null}
      <section className={`mt-5 rounded-2xl border p-4 ${resultTone}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm font-semibold">{resultLabel}</div>
          <div className="text-sm font-medium tabular-nums">
            Gesamt {formatMasteryDeltaSum(review.requirementUpdates ?? [])}
          </div>
        </div>
      </section>

      {review.requirementUpdates && review.requirementUpdates.length ? (
        <section className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-white/50">
            Aufschlüsselung: Requirements
          </div>
          <div className="mt-2 space-y-2">
            {review.requirementUpdates
              .filter((r) => r.percent > 0.001)
              .map((entry) => (
                <div
                  key={entry.requirementId ?? entry.requirementName}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <div className="min-w-0 text-white/85">{entry.requirementName}</div>
                  <div className="shrink-0 text-[#00AE27]/80 tabular-nums">
                    {formatDelta(entry.masteryDelta)}
                  </div>
                </div>
              ))}
          </div>
        </section>
      ) : null}

      {review.errorExplanation ? (
        <section className="mt-3 rounded-3xl border border-rose-500/15 bg-rose-950/40 p-4">
          <div className="text-sm font-semibold text-rose-100">Fehler erklärt</div>
          <p className="mt-2 text-sm text-rose-50/85 whitespace-pre-wrap">
            {review.errorExplanation}
          </p>
        </section>
      ) : null}
      {review.solutionExplanation ? (
        <section className="mt-3 rounded-3xl border border-emerald-500/15 bg-emerald-950/30 p-4">
          <div className="text-sm font-semibold text-emerald-100">Lösungsidee</div>
          <p className="mt-2 text-sm text-emerald-50/85 whitespace-pre-wrap">
            {review.solutionExplanation}
          </p>
        </section>
      ) : null}
      {review.notes ? (
        <section className="mt-3 rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold text-white">Was ich mir für dich gemerkt habe</div>
          <p className="mt-2 text-sm text-white/80 whitespace-pre-wrap">{review.notes}</p>
        </section>
      ) : null}
    </aside>
  );
}

function formatDelta(value: number) {
  const percentage = Math.abs(value) * 100;
  const rounded = Number.isInteger(percentage) ? percentage.toFixed(0) : percentage.toFixed(1);
  return `${value >= 0 ? '+' : '-'}${rounded}%`;
}

function formatMasteryDeltaSum(
  updates: Array<{
    masteryDelta: number;
  }>,
) {
  return formatDelta(updates.reduce((sum, update) => sum + update.masteryDelta, 0));
}
