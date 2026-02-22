import { motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { IoInformation } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import { GhostButton } from '../../../components/Button';
import { studySessionRepo } from '../../../repositories';
import { useActiveSessionStore, type ActiveSession } from '../../../stores/activeSessionStore';
import { useSubjectsStore } from '../../../stores/subjectsStore';
import { useTopicsStore } from '../../../stores/topicsStore';
import { formatDuration } from '../../../utils/time';
import type { SessionSummaryState } from '../modals/SessionReviewModal';
import { useStudyStore } from '../stores/studyStore';
import { formatTaskPath } from '../utils/formatTaskPath';
import { ActiveSessionInfoPanel } from './ActiveSessionInfoPanel';
import { getElapsedMs } from './utils';
import { HUD_VARIANTS_TOP_RIGHT } from '../components/studyHud/hudMotion';

export function ActiveSessionWidget(props: { active: ActiveSession; hidden?: boolean }) {
  const { active, hidden = false } = props;
  const navigate = useNavigate();
  const { end } = useActiveSessionStore();
  const { studySessionId, reset, currentAttempt, taskDepthByAssetId, loadTaskDepth } =
    useStudyStore();

  const [expanded, setExpanded] = useState(false);

  const nowMs = useSessionClock(active);
  const { subjectName, topicName } = useSessionNames(active);
  const depth = currentAttempt?.assetId ? taskDepthByAssetId[currentAttempt.assetId] : undefined;

  useEffect(() => {
    if (!currentAttempt?.assetId) return;
    void loadTaskDepth(currentAttempt.assetId);
  }, [currentAttempt?.assetId, loadTaskDepth]);

  const secondaryLabel = useMemo(() => {
    if (!currentAttempt) return topicName ?? active.topicId;
    return `Aufgabe ${formatTaskPath(currentAttempt, depth)}`;
  }, [active.topicId, currentAttempt, depth, topicName]);

  const elapsedMs = getElapsedMs(active, nowMs);
  const elapsedSeconds = Math.floor(elapsedMs / 1000);

  const timerLabel = useMemo(() => {
    if (!active.plannedDurationMs) return formatDuration(elapsedSeconds);
    const remainingSeconds = Math.ceil((active.plannedDurationMs - elapsedMs) / 1000);
    if (remainingSeconds >= 0) return formatDuration(remainingSeconds);
    return `+${formatDuration(Math.abs(remainingSeconds))}`;
  }, [active.plannedDurationMs, elapsedMs, elapsedSeconds]);

  const stopSession = useCallback(async () => {
    const endedAtMs = Date.now();
    const summary: SessionSummaryState = {
      studySessionId: studySessionId ?? undefined,
      subjectId: active.subjectId,
      topicId: active.topicId,
      startedAtMs: active.startedAtMs,
      endedAtMs,
    };
    if (studySessionId) await studySessionRepo.end(studySessionId, endedAtMs);
    end();
    reset();
    navigate(`/subjects/${active.subjectId}/topics/${active.topicId}`, {
      state: { sessionSummary: summary },
    });
  }, [active.subjectId, active.topicId, active.startedAtMs, end, navigate, reset, studySessionId]);

  return (
    <motion.div
      className="fixed w-[200px] z-1000000000 max-w-[calc(100vw-32px)]"
      style={{ right: 24, top: 24, pointerEvents: hidden ? 'none' : 'auto' }}
      variants={HUD_VARIANTS_TOP_RIGHT}
      initial="hidden"
      animate={hidden ? 'hidden' : 'shown'}
      exit="hidden"
      aria-hidden={hidden}
    >
      <div className="w-full h-full overflow-hidden rounded-full border bg-[#243957]/70 backdrop-blur shadow-lg dark:border-white/5">
        <div className="flex p-1.5">
          <GhostButton onClick={() => setExpanded((v) => !v)} icon={<IoInformation />} />
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-sm pl-1 cursor-pointer min-w-0 text-left"
            aria-expanded={expanded}
          >
            <div className="tabular-nums text-xs font-medium">{timerLabel} </div>
            <div className="truncate text-xs mt-0.5 opacity-70">{secondaryLabel}</div>
          </button>
        </div>
      </div>

      <ActiveSessionInfoPanel
        open={expanded}
        active={active}
        subjectName={subjectName}
        topicName={topicName}
        elapsedSeconds={elapsedSeconds}
        onStop={stopSession}
      />
    </motion.div>
  );
}

function useSessionClock(active: ActiveSession) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (active.pausedAtMs) return;
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [active.startedAtMs, active.pausedAtMs, active.pausedTotalMs, active.plannedDurationMs]);

  return nowMs;
}

function useSessionNames(active: ActiveSession) {
  const { subjects, refresh: refreshSubjects } = useSubjectsStore();
  const { topicsBySubject, refreshBySubject } = useTopicsStore();

  useEffect(() => {
    void refreshSubjects();
  }, [refreshSubjects]);

  useEffect(() => {
    void refreshBySubject(active.subjectId);
  }, [active.subjectId, refreshBySubject]);

  const subjectName = useMemo(() => {
    return subjects.find((s) => s.id === active.subjectId)?.name;
  }, [active.subjectId, subjects]);

  const topicName = useMemo(() => {
    const topics = topicsBySubject[active.subjectId] ?? [];
    return topics.find((t) => t.id === active.topicId)?.name;
  }, [active.subjectId, active.topicId, topicsBySubject]);

  return { subjectName, topicName };
}
