import { useEffect, useMemo, useState } from 'react';
import { IoClose } from 'react-icons/io5';
import { PrimaryButton, SecondaryButton } from '../../../components/Button';
import { Modal } from '../../../components/Modal';
import type {
  Attempt,
  LearnPathSessionRequirement,
  StudySession,
  StudySessionSource,
} from '../../../domain/models';
import {
  assetRepo,
  attemptRepo,
  chapterRepo,
  learnPathSessionRequirementRepo,
  requirementRepo,
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

export type SessionSummaryState = {
  studySessionId?: string;
  subjectId: string;
  topicId: string;
  startedAtMs: number;
  endedAtMs: number;
  source?: StudySessionSource;
};

export function SessionReviewModal(props: {
  open: boolean;
  onClose: () => void;
  summary: SessionSummaryState | null;
  subjectName?: string;
  topicName?: string;
}) {
  const { session, details, learnPathRequirements, assetTitleById, loading, error } = useSessionSummaryData(
    props.open,
    props.summary,
  );
  const source = session?.source ?? props.summary?.source ?? 'exercise';
  const isLearnPathSession = source === 'learnpath';
  const stats = useSessionSummaryStats(details, learnPathRequirements, session, props.summary);

  const message = useMotivationMessage(stats, isLearnPathSession);

  const groups = useSessionExerciseGroups(details, assetTitleById);

  const { aiSummary, aiSummaryLoading, aiSummaryError } = useSessionAiReviewSummary({
    open: props.open,
    summary: props.summary,
    topicName: props.topicName,
    loading,
    error,
    details,
    learnPathRequirements,
    assetTitleById,
    stats,
    source,
  });

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      footer={<PrimaryButton onClick={props.onClose}>Weiter</PrimaryButton>}
    >
      <div className="space-y-2">
        <SecondaryButton
          className="absolute right-6 top-6"
          icon={<IoClose />}
          onClick={props.onClose}
        />

        {loading ? <div className="text-sm text-slate-400">Lade…</div> : null}
        {error ? (
          <div className="rounded-md border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {!loading && !error ? (
          <>
            <AiReviewSummaryCard
              loading={aiSummaryLoading}
              error={aiSummaryError}
              data={aiSummary}
              fallback={
                <div className="flex justify-between gap-3">
                  <span>{message}</span>
                  <span aria-hidden>🚀</span>
                </div>
              }
              details={
                <div className="grid grid-cols-2 gap-2">
                  <StatCard label="Dauer" value={formatDuration(stats.totalSeconds)} />
                  <StatCard label="Arbeitszeit" value={formatDuration(stats.workSeconds)} />
                  <StatCard
                    label={isLearnPathSession ? 'Requirements' : 'Teilaufgaben'}
                    value={String(isLearnPathSession ? stats.requirementCount : stats.attempts)}
                  />
                  <StatCard
                    label={isLearnPathSession ? 'Mastery Delta' : 'Ergebnis'}
                    value={
                      isLearnPathSession
                        ? `${Math.round(stats.totalMasteryDelta * 100)}%`
                        : `✅ ${stats.correct}    🟨 ${stats.partial}  ❌ ${stats.wrong}`
                    }
                  />
                </div>
              }
            />

            <div className="mt-8 space-y-2">
              <div className="text-xs font-semibold text-white/50 mb-1">
                {isLearnPathSession ? 'BEARBEITETE REQUIREMENTS' : 'BEARBEITETE ÜBUNGEN'}
              </div>
              {isLearnPathSession ? (
                learnPathRequirements.length === 0 ? (
                  <div className="text-sm text-white/70">
                    Keine Learn-Path-Requirements in dieser Session gespeichert.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {learnPathRequirements.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-white/6 bg-white/3 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm text-white/50">{item.chapterName}</div>
                            <div className="mt-1 text-lg font-medium text-white">
                              {item.requirementName}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/70">
                              <span className="rounded-full border border-white/8 bg-white/4 px-3 py-1.5">
                                {item.mode === 'review' ? 'Wiederholung' : 'Lernen'}
                              </span>
                              <span className="rounded-full border border-white/8 bg-white/4 px-3 py-1.5">
                                {item.status === 'completed' ? 'Abgeschlossen' : 'In Bearbeitung'}
                              </span>
                              <span className="rounded-full border border-white/8 bg-white/4 px-3 py-1.5">
                                Zeit: {formatDuration(Math.round(item.durationMs / 1000))}
                              </span>
                              <span className="rounded-full border border-white/8 bg-white/4 px-3 py-1.5">
                                Delta: +{Math.round((item.masteryDelta ?? 0) * 100)}%
                              </span>
                            </div>
                          </div>
                          <div className="text-xs text-white/45">
                            {formatClockTime(item.completedAtMs ?? item.updatedAtMs)}
                          </div>
                        </div>
                        {item.aiSummary ? (
                          <div className="mt-3 rounded-xl border border-white/6 bg-slate-950/35 p-3 text-sm text-white/80 whitespace-pre-wrap">
                            {item.aiSummary}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="space-y-2">
                  {groups.length === 0 ? (
                    <div className="text-sm text-white/70">
                      Keine Übungen bearbeitet (keine Attempts).
                    </div>
                  ) : (
                    groups.map((g, idx) => {
                      return (
                        <div
                          key={g.key}
                          className={`pb-8  ${idx !== groups.length - 1 ? 'border border-white' : ''}`}
                        >
                          <div className="pb-4">
                            <div className="text-lg font-medium w-2/3 text-white">
                              {g.title ?? 'Übung'}
                            </div>
                            <div className="mt-3 flex w-2/3 flex-wrap gap-2 text-xs text-white/70">
                              <span className="rounded-full bg-white/3 px-3 py-1.5 border border-white/3">
                                Versuche: {g.stats.attempts}
                              </span>
                              <span className="rounded-full bg-white/3 px-3 py-1.5 border border-white/3">
                                ✅ {g.stats.correct}
                              </span>
                              <span className="rounded-full bg-white/3 px-3 py-1.5 border border-white/3">
                                🟨 {g.stats.partial}
                              </span>
                              <span className="rounded-full bg-white/3 px-3 py-1.5 border border-white/3">
                                ❌ {g.stats.wrong}
                              </span>

                              <span className="rounded-full bg-white/3 px-3 py-1.5 border border-white/3">
                                Zeit: {formatDuration(g.stats.workSeconds)}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            {g.rows.map((r) => (
                              <div
                                key={r.attempt.id}
                                className="rounded-xl border border-white/3 bg-white/1 p-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                      <div className="text-xs font-semibold text-white/50">
                                        Aufgabe{' '}
                                        {formatTaskPath({
                                          problemIdx: r.problemIdx,
                                          subproblemLabel: r.subproblemLabel,
                                          subsubproblemLabel: r.subsubproblemLabel,
                                        })}
                                      </div>
                                    </div>
                                    <div className="mt-1 text-xs text-white/50">
                                      {formatDuration(r.attempt.seconds)} ·{' '}
                                      {formatClockTime(r.attempt.endedAtMs)}
                                    </div>
                                  </div>
                                  <ResultBadge result={r.attempt.result} />
                                </div>
                                {r.attempt.errorType ? (
                                  <div className="mt-2 text-xs text-rose-200">{r.attempt.note}</div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}

function useSessionSummaryData(open: boolean, summary: SessionSummaryState | null) {
  const [session, setSession] = useState<StudySession | null>(null);
  const [details, setDetails] = useState<
    Array<{
      attempt: Attempt;
      assetId: string;
      problemIdx: number;
      subproblemLabel: string;
      subsubproblemLabel?: string;
    }>
  >([]);
  const [learnPathRequirements, setLearnPathRequirements] = useState<LearnPathSessionRequirement[]>([]);
  const [assetTitleById, setAssetTitleById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!open || !summary) return;
      const id = summary.studySessionId;
      setLoading(true);
      setError(null);
      try {
        if (id) {
          const s = await studySessionRepo.get(id);
          if ((s?.source ?? summary.source ?? 'exercise') === 'learnpath') {
            const requirements = await learnPathSessionRequirementRepo.listByStudySession(id);
            if (!cancelled) {
              setSession(s ?? null);
              setDetails([]);
              setLearnPathRequirements(requirements);
              setAssetTitleById({});
            }
          } else {
            const d = await attemptRepo.listDetailsByStudySession(id);
            const assetIds = Array.from(new Set(d.map((x) => x.assetId)));
            const assets = await Promise.all(assetIds.map((aid) => assetRepo.get(aid)));
            const titles: Record<string, string> = {};
            for (const a of assets) {
              if (a) titles[a.id] = a.title;
            }
            if (!cancelled) {
              setSession(s ?? null);
              setDetails(d);
              setLearnPathRequirements([]);
              setAssetTitleById(titles);
            }
          }
        } else if (!cancelled) {
          setSession(null);
          setDetails([]);
          setLearnPathRequirements([]);
          setAssetTitleById({});
        }
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
  }, [open, summary]);

  return { session, details, learnPathRequirements, assetTitleById, loading, error };
}

function useSessionSummaryStats(
  details: Array<{ attempt: Attempt }>,
  learnPathRequirements: LearnPathSessionRequirement[],
  session: StudySession | null,
  summary: SessionSummaryState | null,
) {
  return useMemo(() => {
    const attempts = details.map((d) => d.attempt);
    const correct = attempts.filter((a) => a.result === 'correct').length;
    const partial = attempts.filter((a) => a.result === 'partial').length;
    const wrong = attempts.filter((a) => a.result === 'wrong').length;
    const workSeconds =
      learnPathRequirements.length > 0
        ? Math.round(
            learnPathRequirements.reduce((acc, item) => acc + item.durationMs, 0) / 1000,
          )
        : attempts.reduce((acc, a) => acc + a.seconds, 0);
    const startedAtMs = session?.startedAtMs ?? summary?.startedAtMs ?? 0;
    const endedAtMs = session?.endedAtMs ?? summary?.endedAtMs ?? 0;
    const totalSeconds =
      startedAtMs && endedAtMs ? Math.max(0, Math.floor((endedAtMs - startedAtMs) / 1000)) : 0;
    const requirementCount = learnPathRequirements.length;
    const completedRequirements = learnPathRequirements.filter((item) => item.status === 'completed').length;
    const totalMasteryDelta = learnPathRequirements.reduce(
      (acc, item) => acc + (item.masteryDelta ?? 0),
      0,
    );
    return {
      correct,
      partial,
      wrong,
      workSeconds,
      totalSeconds,
      attempts: attempts.length,
      requirementCount,
      completedRequirements,
      totalMasteryDelta,
    };
  }, [details, learnPathRequirements, session, summary]);
}

function useMotivationMessage(
  stats: { attempts: number; correct: number; wrong: number; requirementCount: number; completedRequirements: number },
  isLearnPathSession: boolean,
) {
  return useMemo(() => {
    if (isLearnPathSession) {
      if (stats.requirementCount === 0) return 'Stark, dass du den Lernpfad gestartet hast. Der nächste Schritt sitzt schon bereit.';
      if (stats.completedRequirements === 0) return 'Guter Zwischenstand. Du hast Substanz aufgebaut und kannst nahtlos weitermachen.';
      return 'Solide Learn-Path-Session. Du hast sichtbaren Fortschritt in deinem Themenaufbau gemacht.';
    }
    if (stats.attempts === 0) return 'Stark, dass du gestartet hast. Morgen wieder 1 Schritt.';
    if (stats.attempts < 4) return 'Guter Start. Konstanz schlägt alles.';
    if (stats.correct >= stats.wrong) return 'Sehr solide Session. Du bist auf Kurs.';
    return 'Auch harte Sessions zählen – du weißt jetzt, was du üben musst.';
  }, [
    isLearnPathSession,
    stats.attempts,
    stats.completedRequirements,
    stats.correct,
    stats.requirementCount,
    stats.wrong,
  ]);
}

type SessionDetailRow = {
  attempt: Attempt;
  assetId: string;
  problemIdx: number;
  subproblemLabel: string;
  subsubproblemLabel?: string;
};

type SessionExerciseGroup = {
  key: string;
  assetId: string;
  title: string;
  rows: Array<{
    attempt: Attempt;
    problemIdx: number;
    subproblemLabel: string;
    subsubproblemLabel?: string;
  }>;
  stats: {
    attempts: number;
    correct: number;
    partial: number;
    wrong: number;
    workSeconds: number;
  };
};

function buildSessionExerciseGroups(
  details: SessionDetailRow[],
  assetTitleById: Record<string, string>,
): SessionExerciseGroup[] {
  const map = new Map<string, SessionExerciseGroup>();
  for (const d of details) {
    const key = `${d.assetId}`;
    const title = `${assetTitleById[d.assetId] ?? 'Übung'}`;
    const existing = map.get(key);
    const row = {
      attempt: d.attempt,
      problemIdx: d.problemIdx,
      subproblemLabel: d.subproblemLabel,
      subsubproblemLabel: d.subsubproblemLabel,
    };
    if (!existing) {
      map.set(key, {
        key,
        assetId: d.assetId,
        title,
        rows: [row],
        stats: {
          attempts: 0,
          correct: 0,
          partial: 0,
          wrong: 0,
          workSeconds: 0,
        },
      });
    } else {
      existing.rows.push(row);
    }
  }

  const groups = Array.from(map.values());
  for (const g of groups) {
    g.rows.sort((a, b) => a.attempt.endedAtMs - b.attempt.endedAtMs);
    g.stats.attempts = g.rows.length;
    g.stats.correct = g.rows.filter((r) => r.attempt.result === 'correct').length;
    g.stats.partial = g.rows.filter((r) => r.attempt.result === 'partial').length;
    g.stats.wrong = g.rows.filter((r) => r.attempt.result === 'wrong').length;
    g.stats.workSeconds = g.rows.reduce((acc, r) => acc + r.attempt.seconds, 0);
  }
  groups.sort((a, b) => a.title.localeCompare(b.title));
  return groups;
}

function useSessionExerciseGroups(
  details: SessionDetailRow[],
  assetTitleById: Record<string, string>,
) {
  return useMemo(
    () => buildSessionExerciseGroups(details, assetTitleById),
    [details, assetTitleById],
  );
}

function useSessionAiReviewSummary(input: {
  open: boolean;
  summary: SessionSummaryState | null;
  source: StudySessionSource;
  topicName?: string;
  loading: boolean;
  error: string | null;
  details: SessionDetailRow[];
  learnPathRequirements: LearnPathSessionRequirement[];
  assetTitleById: Record<string, string>;
  stats: {
    correct: number;
    partial: number;
    wrong: number;
    workSeconds: number;
    totalSeconds: number;
    attempts: number;
    requirementCount: number;
    completedRequirements: number;
    totalMasteryDelta: number;
  };
}) {
  const [aiSummary, setAiSummary] = useState<ReviewSummaryResponse | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummaryError, setAiSummaryError] = useState<string | null>(null);

  const detailKey = useMemo(
    () =>
      input.source === 'learnpath'
        ? input.learnPathRequirements
            .map((item) => item.id)
            .sort()
            .join(',')
        : input.details.length
        ? input.details
            .map((d) => d.attempt.id)
            .sort()
            .join(',')
        : '',
    [input.details, input.learnPathRequirements, input.source],
  );

  useEffect(() => {
    let cancelled = false;
    if (!input.open || !input.summary || input.loading || input.error || !detailKey) {
      setAiSummary(null);
      setAiSummaryLoading(false);
      setAiSummaryError(null);
      return;
    }

    setAiSummaryLoading(true);
    setAiSummaryError(null);
    setAiSummary(null);

    void (async () => {
      const summaryState = input.summary;
      if (!summaryState) return;
      try {
        const chapters = await chapterRepo.listByTopic(summaryState.topicId);
        const chapterIds = chapters.map((c) => c.id);
        const requirements =
          chapterIds.length > 0 ? await requirementRepo.listByChapterIds(chapterIds) : [];

        const reqsByChapter = new Map<string, typeof requirements>();
        for (const r of requirements) {
          const list = reqsByChapter.get(r.chapterId) ?? [];
          list.push(r);
          reqsByChapter.set(r.chapterId, list);
        }

        let totalMastery = 0;
        for (const r of requirements) totalMastery += r.mastery;
        const avgRequirementMastery =
          requirements.length > 0 ? totalMastery / requirements.length : 0;

        const chapterSnapshots = chapters.slice(0, 8).map((ch) => {
          const rs = reqsByChapter.get(ch.id) ?? [];
          const avg = rs.length ? rs.reduce((s, x) => s + x.mastery, 0) / rs.length : 0;
          return { name: ch.name, avgMastery: avg, requirementCount: rs.length };
        });

        const weakest = [...requirements]
          .sort((a, b) => a.mastery - b.mastery)
          .slice(0, 5)
          .map((r) => ({ name: r.name, mastery: r.mastery }));

        const topicContext = {
          topicName: input.topicName,
          avgRequirementMastery,
          chapters: chapterSnapshots,
          weakest,
        };
        const data =
          input.source === 'learnpath'
            ? await requestReviewSummary({
                scope: 'session',
                session: {
                  sessionKind: 'learnpath',
                  sessionDuration: formatDurationForAiReview(input.stats.totalSeconds),
                  workTime: formatDurationForAiReview(input.stats.workSeconds),
                  exerciseCount: input.stats.requirementCount,
                  totals: {
                    attempts: input.stats.requirementCount,
                    correct: input.stats.completedRequirements,
                    partial: 0,
                    wrong: Math.max(0, input.stats.requirementCount - input.stats.completedRequirements),
                    workTime: formatDurationForAiReview(input.stats.workSeconds),
                  },
                  exercises: input.learnPathRequirements.map((item) => ({
                    title: item.requirementName,
                    totals: {
                      attempts: 1,
                      correct: item.status === 'completed' ? 1 : 0,
                      partial: 0,
                      wrong: item.status === 'completed' ? 0 : 1,
                      workTime: formatDurationForAiReview(Math.round(item.durationMs / 1000)),
                    },
                  })),
                  topicContext,
                  learnPath: {
                    requirementCount: input.stats.requirementCount,
                    completedCount: input.stats.completedRequirements,
                    totalMasteryDeltaPercent: Math.round(input.stats.totalMasteryDelta * 100),
                    requirements: input.learnPathRequirements.map((item) => ({
                      name: item.requirementName,
                      chapterName: item.chapterName,
                      mode: item.mode,
                      status: item.status,
                      duration: formatDurationForAiReview(Math.round(item.durationMs / 1000)),
                      masteryDeltaPercent: Math.round((item.masteryDelta ?? 0) * 100),
                      summary: item.aiSummary,
                    })),
                  },
                },
              })
            : await (async () => {
                const groups = buildSessionExerciseGroups(input.details, input.assetTitleById);
                return requestReviewSummary({
                  scope: 'session',
                  session: {
                    sessionKind: 'exercise',
                    sessionDuration: formatDurationForAiReview(input.stats.totalSeconds),
                    workTime: formatDurationForAiReview(input.stats.workSeconds),
                    exerciseCount: groups.length,
                    totals: {
                      attempts: input.stats.attempts,
                      correct: input.stats.correct,
                      partial: input.stats.partial,
                      wrong: input.stats.wrong,
                      workTime: formatDurationForAiReview(input.stats.workSeconds),
                    },
                    exercises: groups.map((g) => ({
                      title: g.title,
                      totals: {
                        attempts: g.stats.attempts,
                        correct: g.stats.correct,
                        partial: g.stats.partial,
                        wrong: g.stats.wrong,
                        workTime: formatDurationForAiReview(g.stats.workSeconds),
                      },
                    })),
                    topicContext,
                  },
                });
              })();
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
  }, [
    input.open,
    input.summary,
    input.source,
    input.loading,
    input.error,
    input.topicName,
    detailKey,
    input.details,
    input.learnPathRequirements,
    input.assetTitleById,
    input.stats.attempts,
    input.stats.completedRequirements,
    input.stats.correct,
    input.stats.partial,
    input.stats.requirementCount,
    input.stats.totalMasteryDelta,
    input.stats.wrong,
    input.stats.workSeconds,
    input.stats.totalSeconds,
  ]);

  return { aiSummary, aiSummaryLoading, aiSummaryError };
}

function ResultBadge(props: { result: Attempt['result'] }) {
  const label = props.result === 'correct' ? '✅' : props.result === 'partial' ? '🟨' : '❌';
  const cls =
    props.result === 'correct'
      ? 'bg-emerald-950/40 text-emerald-200 border-emerald-900/50'
      : props.result === 'partial'
        ? 'bg-amber-950/40 text-amber-200 border-amber-900/50'
        : 'bg-rose-950/40 text-rose-200 border-rose-900/50';
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-1 text-sm ${cls}`}>
      {label}
    </span>
  );
}

function StatCard(props: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white/3 border-white/3 p-3">
      <div className="text-xs text-white/50">{props.label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{props.value}</div>
    </div>
  );
}
