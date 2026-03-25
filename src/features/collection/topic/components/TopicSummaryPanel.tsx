import { useEffect, useMemo, useRef, useState } from 'react';
import { PrimaryButton } from '../../../../components/Button';
import type { Asset, Chapter, ExercisePageStatus, Requirement } from '../../../../domain/models';
import { useCurriculumStore } from '../../../../stores/curriculumStore';
import { formatDuration, formatDurationForAiReview } from '../../../../utils/time';
import { requestTopicSummary } from '../../../session/ai/aiClient';
import { formatExerciseStatus } from '../../../session/viewer/viewerUtils';
import { formatLastStudied } from '../utils/formatLastStudied';
import { loadTopicStudyAggregates, type TopicStudyAggregates } from '../utils/topicStudyStats';
import {
  localCalendarDayKey,
  readTopicSummaryCache,
  writeTopicSummaryCache,
} from '../utils/topicSummaryCache';

const EMPTY_CHAPTERS: Chapter[] = [];
const EMPTY_REQUIREMENTS: Requirement[] = [];

type Props = {
  topicId: string;
  topicName?: string;
  subjectName?: string;
  assets: Asset[];
  exerciseStatusByAssetId: Record<string, ExercisePageStatus>;
  onOpenCurriculum: () => void;
  sessionRegenKey: number;
};

const STATUS_ORDER: ExercisePageStatus[] = ['unknown', 'partial', 'captured', 'covered'];

export function TopicSummaryPanel(props: Props) {
  const refreshTopicCurriculum = useCurriculumStore((s) => s.refreshTopicCurriculum);
  const chapters = useCurriculumStore((s) => s.chaptersByTopic[props.topicId] ?? EMPTY_CHAPTERS);
  const requirements = useCurriculumStore(
    (s) => s.requirementsByTopic[props.topicId] ?? EMPTY_REQUIREMENTS,
  );
  const curriculumLoading = useCurriculumStore((s) => s.loadingByTopic[props.topicId] ?? false);

  const lastTopicIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastTopicIdRef.current === props.topicId) return;
    lastTopicIdRef.current = props.topicId;

    const s = useCurriculumStore.getState();
    const alreadyLoaded = (s.chaptersByTopic[props.topicId]?.length ?? 0) > 0;
    const isLoading = s.loadingByTopic[props.topicId] ?? false;
    if (alreadyLoaded || isLoading) return;

    void refreshTopicCurriculum(props.topicId);
  }, [props.topicId, refreshTopicCurriculum]);

  const [studyAgg, setStudyAgg] = useState<TopicStudyAggregates | null>(null);
  useEffect(() => {
    let cancelled = false;
    setStudyAgg(null);
    void (async () => {
      const a = await loadTopicStudyAggregates(props.topicId);
      if (!cancelled) setStudyAgg(a);
    })();
    return () => {
      cancelled = true;
    };
  }, [props.topicId, props.sessionRegenKey]);

  const topicMasteryPercent = useMemo(() => {
    if (requirements.length === 0) return null;
    const avg = requirements.reduce((sum, r) => sum + r.mastery, 0) / requirements.length;
    const clamped = Math.max(0, Math.min(1, Number.isFinite(avg) ? avg : 0));
    return Math.round(clamped * 100);
  }, [requirements]);

  const exerciseAssets = useMemo(
    () => props.assets.filter((a) => a.type === 'exercise'),
    [props.assets],
  );

  const exerciseStatusCounts = useMemo(() => {
    const counts: Record<ExercisePageStatus, number> = {
      unknown: 0,
      partial: 0,
      captured: 0,
      covered: 0,
    };
    for (const a of exerciseAssets) {
      const st = props.exerciseStatusByAssetId[a.id] ?? 'unknown';
      counts[st] += 1;
    }
    return counts;
  }, [exerciseAssets, props.exerciseStatusByAssetId]);

  const unknownExerciseRatio = useMemo(() => {
    if (exerciseAssets.length === 0) return 0;
    return exerciseStatusCounts.unknown / exerciseAssets.length;
  }, [exerciseAssets.length, exerciseStatusCounts.unknown]);

  const requirementsSignal = useMemo(
    () => requirements.map((r) => `${r.id}:${r.mastery}`).join('|'),
    [requirements],
  );
  const chaptersSignal = useMemo(() => chapters.map((c) => c.id).join('|'), [chapters]);

  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    if (!studyAgg || curriculumLoading) return;

    const calendarDay = localCalendarDayKey();
    const sessionRevision = studyAgg.sessionRevision;
    const cached = readTopicSummaryCache(props.topicId);
    if (
      cached &&
      cached.calendarDay === calendarDay &&
      cached.sessionRevision === sessionRevision
    ) {
      setSummaryText(cached.summary);
      setSummaryLoading(false);
      setSummaryError(null);
      return;
    }

    let cancelled = false;

    const reqsByChapter = new Map<string, Requirement[]>();
    for (const r of requirements) {
      const list = reqsByChapter.get(r.chapterId) ?? [];
      list.push(r);
      reqsByChapter.set(r.chapterId, list);
    }

    let totalMastery = 0;
    for (const r of requirements) totalMastery += r.mastery;
    const avgRequirementMastery = requirements.length > 0 ? totalMastery / requirements.length : 0;

    const chapterSnapshots = chapters.slice(0, 12).map((ch) => {
      const rs = reqsByChapter.get(ch.id) ?? [];
      const avg = rs.length ? rs.reduce((s, x) => s + x.mastery, 0) / rs.length : 0;
      return { name: ch.name, avgMastery: avg, requirementCount: rs.length };
    });

    const weakest = [...requirements]
      .sort((a, b) => a.mastery - b.mastery)
      .slice(0, 5)
      .map((r) => ({ name: r.name, mastery: r.mastery }));

    const weakRequirementCount = requirements.filter((r) => r.mastery < 0.4).length;

    void (async () => {
      setSummaryLoading(true);
      setSummaryError(null);
      try {
        const { summary } = await requestTopicSummary({
          topic: {
            topicName: props.topicName,
            subjectName: props.subjectName,
            avgRequirementMastery,
            requirementCount: requirements.length,
            weakRequirementCount,
            chapters: chapterSnapshots,
            weakest,
            completedSessionCount: studyAgg.completedSessionCount,
            totalAttempts: studyAgg.totalAttempts,
            totalWorkTimeFormatted: formatDurationForAiReview(studyAgg.totalWorkSeconds),
            exerciseAssetCount: exerciseAssets.length,
            exerciseStatusCounts,
            unknownExerciseRatio,
          },
        });
        if (!cancelled) {
          setSummaryText(summary);
          writeTopicSummaryCache(props.topicId, {
            calendarDay,
            sessionRevision,
            summary,
          });
        }
      } catch (e) {
        if (!cancelled) {
          setSummaryError(e instanceof Error ? e.message : 'KI-Zusammenfassung fehlgeschlagen');
          setSummaryText(null);
        }
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    studyAgg,
    curriculumLoading,
    props.topicId,
    props.topicName,
    props.subjectName,
    requirementsSignal,
    chaptersSignal,
  ]);

  const lastStudiedLabel =
    studyAgg?.lastStudiedMs != null ? formatLastStudied(studyAgg.lastStudiedMs) : 'noch nicht';

  const workLabel =
    studyAgg && studyAgg.totalWorkSeconds > 0
      ? formatDuration(studyAgg.totalWorkSeconds)
      : '0 Sekunden';

  return (
    <section className="mb-8 rounded-3xl border border-white/8 bg-white/4 p-8">
      <div className="grid gap-12 xl:gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex h-full flex-col gap-4">
          <div>
            <div className="text-5xl font-semibold tracking-tight text-white md:text-6xl">
              {topicMasteryPercent !== null ? `${topicMasteryPercent}%` : '–'}
            </div>
            <button className="text-sm text-white/60 mt-2" onClick={props.onOpenCurriculum}>
              Zu Kapiteln &amp; Skills
            </button>
          </div>
          <div className="w-2/3 h-fit flex flex-col gap-2 mt-auto">
            <PrimaryButton onClick={() => {}}>Weiter lernen</PrimaryButton>
          </div>
        </div>

        <div className="min-h-[120px]">
          {summaryLoading ? (
            <p className="text-sm text-white/55">Zusammenfassung wird erstellt…</p>
          ) : summaryError ? (
            <p className="text-sm text-rose-200">{summaryError}</p>
          ) : summaryText ? (
            <p className="text-sm leading-relaxed text-white/85">{summaryText}</p>
          ) : (
            <p className="text-sm text-white/55">
              Hier erscheint eine KI-Zusammenfassung zu deinem Stand, sobald Daten geladen sind.
            </p>
          )}
        </div>

        <div className="space-y-4 text-sm">
          <div>
            <div className="text-white/50">Gesamtarbeitszeit im Thema</div>
            <div className="mt-0.5 text-lg font-medium text-white">{workLabel}</div>
          </div>
          <div>
            <div className="text-white/50">Zuletzt gelernt</div>
            <div className="mt-0.5 font-medium text-white">{lastStudiedLabel}</div>
          </div>
          <div>
            <div className="mb-2 text-white/50">Übungen nach Status</div>
            <ul className="space-y-1.5">
              {STATUS_ORDER.map((status) => (
                <li
                  key={status}
                  className="flex justify-between gap-3 border-b border-white/5 pb-1.5 last:border-0"
                >
                  <span className="text-white/75">{formatExerciseStatus(status)}</span>
                  <span className="tabular-nums text-white">{exerciseStatusCounts[status]}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
