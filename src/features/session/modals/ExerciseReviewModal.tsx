import { useEffect, useMemo, useState } from 'react';
import { PrimaryButton, SecondaryButton } from '../../../components/Button';
import { Modal } from '../../../components/Modal';
import type { Attempt, AttemptAiReview } from '../../../domain/models';
import {
  assetRepo,
  attemptAiReviewRepo,
  attemptRepo,
  studySessionRepo,
} from '../../../repositories';
import {
  formatClockTime,
  formatDuration,
  formatDurationForAiReview,
} from '../../../utils/time';
import { requestReviewSummary } from '../ai/aiClient';
import type { ReviewSummaryResponse } from '../ai/reviewSummaryTypes';
import { AiReviewSummaryCard } from '../components/AiReviewSummaryCard';
import { formatTaskPath } from '../utils/formatTaskPath';

type Row = {
  attempt: Attempt;
  problemIdx: number;
  subproblemLabel: string;
  subsubproblemLabel?: string;
  aiReview?: AttemptAiReview;
};

export function ExerciseReviewModal(props: {
  open: boolean;
  onClose: () => void;
  studySessionId: string | null;
  assetId: string;
  onGoToTopic: () => void;
  onEndSession: () => Promise<void> | void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<ReviewSummaryResponse | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummaryError, setAiSummaryError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!props.open) return;
      if (!props.studySessionId) {
        setRows([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        await studySessionRepo.get(props.studySessionId);
        const attempts = await attemptRepo.listForSessionAsset({
          studySessionId: props.studySessionId,
          assetId: props.assetId,
        });
        const aiReviews = await Promise.all(
          attempts.map(async (row) => ({
            attemptId: row.attempt.id,
            review: await attemptAiReviewRepo.getByAttempt(row.attempt.id),
          })),
        );
        const aiReviewByAttemptId = new Map(
          aiReviews
            .filter((row) => row.review)
            .map((row) => [row.attemptId, row.review as AttemptAiReview]),
        );
        if (!cancelled)
          setRows(
            attempts.map((row) => ({
              ...row,
              aiReview: aiReviewByAttemptId.get(row.attempt.id),
            })),
          );
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Fehler');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [props.open, props.studySessionId, props.assetId]);

  const rowsFingerprint = useMemo(
    () => rows.map((r) => `${r.attempt.id}:${r.attempt.endedAtMs}`).join('|'),
    [rows],
  );

  useEffect(() => {
    let cancelled = false;
    if (!props.open || !props.studySessionId || rows.length === 0) {
      setAiSummary(null);
      setAiSummaryLoading(false);
      setAiSummaryError(null);
      return;
    }
    setAiSummaryLoading(true);
    setAiSummaryError(null);
    setAiSummary(null);
    void (async () => {
      try {
        const asset = await assetRepo.get(props.assetId);
        const title = asset?.title?.trim() || 'Übung';
        const correct = rows.filter((r) => r.attempt.result === 'correct').length;
        const partial = rows.filter((r) => r.attempt.result === 'partial').length;
        const wrong = rows.filter((r) => r.attempt.result === 'wrong').length;
        const workSeconds = rows.reduce((acc, r) => acc + r.attempt.seconds, 0);
        const items = rows.map((r) => ({
          path: formatTaskPath({
            problemIdx: r.problemIdx,
            subproblemLabel: r.subproblemLabel,
            subsubproblemLabel: r.subsubproblemLabel,
          }),
          result: r.attempt.result,
          duration: formatDurationForAiReview(r.attempt.seconds),
          ...(r.aiReview?.score !== undefined ? { aiScore: r.aiReview.score } : {}),
        }));
        const data = await requestReviewSummary({
          scope: 'exercise',
          exercise: {
            title,
            totals: {
              attempts: rows.length,
              correct,
              partial,
              wrong,
              workTime: formatDurationForAiReview(workSeconds),
            },
            items,
          },
        });
        if (!cancelled) setAiSummary(data);
      } catch (e) {
        if (!cancelled)
          setAiSummaryError(e instanceof Error ? e.message : 'KI-Zusammenfassung fehlgeschlagen');
      } finally {
        if (!cancelled) setAiSummaryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.open, props.studySessionId, props.assetId, rowsFingerprint]);

  const stats = useMemo(() => {
    const totalSeconds = rows.reduce((acc, r) => acc + r.attempt.seconds, 0);
    const correct = rows.filter((r) => r.attempt.result === 'correct').length;
    const partial = rows.filter((r) => r.attempt.result === 'partial').length;
    const wrong = rows.filter((r) => r.attempt.result === 'wrong').length;
    return { totalSeconds, correct, partial, wrong, count: rows.length };
  }, [rows]);

  const grouped = useMemo(() => {
    const byProblem = new Map<
      number,
      Map<string, { leafKey: string; path: string; attempts: Attempt[] }>
    >();
    for (const r of rows) {
      const p = r.problemIdx;
      const leafKey = `${(r.subproblemLabel ?? '').trim()}|||${(
        r.subsubproblemLabel ?? ''
      ).trim()}`;
      const path = formatTaskPath({
        problemIdx: r.problemIdx,
        subproblemLabel: r.subproblemLabel,
        subsubproblemLabel: r.subsubproblemLabel,
      });
      const sub =
        byProblem.get(p) ??
        new Map<string, { leafKey: string; path: string; attempts: Attempt[] }>();
      const entry = sub.get(leafKey) ?? { leafKey, path, attempts: [] };
      entry.attempts.push(r.attempt);
      sub.set(leafKey, entry);
      byProblem.set(p, sub);
    }
    const problems = Array.from(byProblem.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([problemIdx, sub]) => ({
        problemIdx,
        leaves: Array.from(sub.values())
          .map((x) => ({
            leafKey: x.leafKey,
            path: x.path,
            attempts: x.attempts.slice().sort((a, b) => b.endedAtMs - a.endedAtMs),
          }))
          .sort((a, b) => a.path.localeCompare(b.path)),
      }));
    return problems;
  }, [rows]);

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      footer={
        <>
          <SecondaryButton onClick={props.onEndSession}>Session beenden</SecondaryButton>

          <PrimaryButton onClick={props.onClose}>Weiter</PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        {!loading && !error && rows.length > 0 ? (
          <AiReviewSummaryCard
            loading={aiSummaryLoading}
            error={aiSummaryError}
            data={aiSummary}
            fallback="Die KI-Zusammenfassung konnte nicht geladen werden."
            details={
              <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                <span className="rounded-full bg-white/5 px-3 py-1.5 border border-white/5">
                  Aufgaben: {stats.count}
                </span>
                <span className="rounded-full bg-white/5 px-3 py-1.5 border border-white/5">
                  ✅ {stats.correct}
                </span>
                <span className="rounded-full bg-white/5 px-3 py-1.5 border border-white/5">
                  🟨 {stats.partial}
                </span>
                <span className="rounded-full bg-white/5 px-3 py-1.5 border border-white/5">
                  ❌ {stats.wrong}
                </span>
                <span className="rounded-full bg-white/5 px-3 py-1.5 border border-white/5">
                  Zeit: {formatDuration(stats.totalSeconds)}
                </span>
              </div>
            }
          />
        ) : null}

        {loading ? <div className="text-sm text-slate-400">Lade…</div> : null}
        {error ? (
          <div className="rounded-md border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {!loading && !error ? (
          rows.length ? (
            <div className="space-y-3 mt-8">
              {grouped.map((p) => (
                <div key={p.problemIdx}>
                  <div className="text-xs font-semibold text-white/50 mt-6">
                    Aufgabe {p.problemIdx}
                  </div>
                  <div className="mt-2 space-y-2">
                    {p.leaves.map((leaf) => (
                      <div
                        key={`${p.problemIdx}:${leaf.leafKey}`}
                        className="rounded-xl border border-white/5 bg-white/3 p-3"
                      >
                        {(() => {
                          const a = leaf.attempts[0];
                          return (
                            <>
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <div className="text-sm font-medium text-white">
                                      Aufgabe {leaf.path}
                                    </div>
                                    {leaf.attempts.length > 1 ? (
                                      <span className="text-xs">
                                        ({leaf.attempts.length} Versuche)
                                      </span>
                                    ) : null}
                                  </div>

                                  {a ? (
                                    <div className="mt-1 text-xs text-white/50">
                                      {formatDuration(a.seconds)} · {formatClockTime(a.endedAtMs)}
                                    </div>
                                  ) : (
                                    <div className="mt-1 text-xs text-slate-400">Kein Versuch</div>
                                  )}
                                </div>
                                {a ? (
                                  <ResultBadge result={a.result} reviewStatus={a.reviewStatus} />
                                ) : null}
                              </div>

                              {a?.errorType ? (
                                <div className="mt-2 text-xs text-rose-200">
                                  Fehler: {a.errorType}
                                </div>
                              ) : null}

                              {a?.note ? (
                                <div className="mt-1 text-xs text-slate-200">
                                  <span className="text-white/80 font-semibold">Notiz:</span>{' '}
                                  {a.note}
                                </div>
                              ) : null}
                            </>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-400">
              Keine Versuche in dieser Übung (in der aktuellen Session).
            </div>
          )
        ) : null}
      </div>
    </Modal>
  );
}

function ResultBadge(props: { result: Attempt['result']; reviewStatus: Attempt['reviewStatus'] }) {
  if (props.reviewStatus === 'queued' || props.reviewStatus === 'processing') {
    return (
      <span className="inline-flex items-center rounded-md border px-2 py-1 m-0.5 border-sky-500/10 bg-sky-500/5 text-sky-200">
        KI prüft…
      </span>
    );
  }
  if (props.reviewStatus === 'manual_required') {
    return (
      <span className="inline-flex items-center rounded-md border px-2 py-1 m-0.5 border-amber-500/10 bg-amber-500/5 text-amber-200">
        Manuell prüfen
      </span>
    );
  }
  const label = props.result === 'correct' ? '✅' : props.result === 'partial' ? '🟨' : '❌';
  const cls =
    props.result === 'correct'
      ? 'bg-emerald-500/5 text-emerald-200 border-emerald-500/10'
      : props.result === 'partial'
        ? 'bg-amber-500/5 text-amber-200 border-amber-500/10'
        : 'bg-rose-500/5 text-rose-200 border-rose-500/10';
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-1 m-0.5 ${cls}`}>
      {label}
    </span>
  );
}
