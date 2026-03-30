import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Chapter, LearnPathMode, LearnPathProgress, Requirement } from '../../../../domain/models';
import { newId } from '../../../../lib/id';
import { learnPathProgressRepo, requirementRepo } from '../../../../repositories';
import { useCurriculumStore } from '../../../../stores/curriculumStore';
import { useNotificationsStore } from '../../../../stores/notificationsStore';
import { requestRequirementPlanTurn } from './ai/requirementRailAiClient';
import { reduceLearnPathState } from './learnPathReducer';
import {
  buildGroupedRequirements,
  buildRequirementGoal,
  buildRequirementHistory,
  buildRequirementOverviewItems,
  clampMastery,
  clampMasteryDelta,
  describeResponse,
  formatMasteryDelta,
  getActivePlanStep,
  getCurrentRequirementPosition,
  getFirstOpenRequirement,
  getLatestInProgressProgress,
  parseLearnPathMessagesJson,
  parseRequirementPlanJson,
  serializeLearnPathMessages,
  serializeRequirementPlan,
} from './learnPathUtils';
import {
  initialLearnPathState,
  type LearnPathAction,
  type LearnPathExercise,
  type LearnPathGroup,
  type LearnPathRequirementOverviewItem,
  type LearnPathState,
  type LearnPathTurnResponse,
} from './types';

const EMPTY_CHAPTERS: Chapter[] = [];
const EMPTY_REQUIREMENTS: Requirement[] = [];

export function useLearnPathController(props: {
  topicId: string;
  topicName?: string;
  subjectName?: string;
}) {
  const refreshTopicCurriculum = useCurriculumStore((s) => s.refreshTopicCurriculum);
  const chapters = useCurriculumStore((s) => s.chaptersByTopic[props.topicId] ?? EMPTY_CHAPTERS);
  const requirements = useCurriculumStore((s) => s.requirementsByTopic[props.topicId] ?? EMPTY_REQUIREMENTS);
  const curriculumLoading = useCurriculumStore((s) => s.loadingByTopic[props.topicId] ?? false);
  const curriculumError = useCurriculumStore((s) => s.errorByTopic[props.topicId]);
  const pushNotification = useNotificationsStore((s) => s.push);

  const [draft, setDraft] = useState('');
  const [progressRows, setProgressRows] = useState<LearnPathProgress[]>([]);
  const [state, dispatch] = useReducer(
    (currentState: LearnPathState, action: LearnPathAction) =>
      reduceLearnPathState(currentState, action),
    initialLearnPathState,
  );
  const stateRef = useRef(state);
  const groupedRequirementsRef = useRef<LearnPathGroup[]>([]);
  const progressRowsRef = useRef<LearnPathProgress[]>([]);
  const lastTopicIdRef = useRef<string | null>(null);
  const handledRequestNonceRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    progressRowsRef.current = progressRows;
  }, [progressRows]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadProgress = useCallback(async () => {
    dispatch({ type: 'SET_PROGRESS_LOADING', loading: true });
    try {
      const rows = await learnPathProgressRepo.listByTopic(props.topicId);
      if (mountedRef.current) setProgressRows(rows);
    } finally {
      if (mountedRef.current) dispatch({ type: 'SET_PROGRESS_LOADING', loading: false });
    }
  }, [props.topicId]);

  useEffect(() => {
    if (lastTopicIdRef.current === props.topicId) return;
    lastTopicIdRef.current = props.topicId;
    handledRequestNonceRef.current = 0;
    setDraft('');
    setProgressRows([]);
    dispatch({ type: 'RESET_TO_OVERVIEW' });

    const store = useCurriculumStore.getState();
    const alreadyLoaded = (store.chaptersByTopic[props.topicId]?.length ?? 0) > 0;
    const isLoading = store.loadingByTopic[props.topicId] ?? false;
    if (!alreadyLoaded && !isLoading) void refreshTopicCurriculum(props.topicId);
    void loadProgress();
  }, [loadProgress, props.topicId, refreshTopicCurriculum]);

  const groupedRequirements = useMemo(
    () => buildGroupedRequirements(chapters, requirements),
    [chapters, requirements],
  );

  useEffect(() => {
    groupedRequirementsRef.current = groupedRequirements;
  }, [groupedRequirements]);

  const overviewItems = useMemo(
    () => buildRequirementOverviewItems(groupedRequirements, progressRows),
    [groupedRequirements, progressRows],
  );
  const latestInProgress = useMemo(() => getLatestInProgressProgress(progressRows), [progressRows]);
  const firstOpenRequirement = useMemo(
    () => getFirstOpenRequirement(overviewItems),
    [overviewItems],
  );

  const totalRequirements = useMemo(
    () => groupedRequirements.reduce((sum, group) => sum + group.requirements.length, 0),
    [groupedRequirements],
  );

  const currentGroup = groupedRequirements[state.currentChapterIndex];
  const currentRequirement = currentGroup?.requirements[state.currentRequirementIndex];
  const currentChapter = currentGroup?.chapter;
  const activeStep = useMemo(
    () => getActivePlanStep(state.activePlan, state.activeStepId),
    [state.activePlan, state.activeStepId],
  );
  const currentRequirementPosition = useMemo(
    () =>
      getCurrentRequirementPosition(
        groupedRequirements,
        state.currentChapterIndex,
        state.currentRequirementIndex,
        Boolean(currentRequirement),
      ),
    [currentRequirement, groupedRequirements, state.currentChapterIndex, state.currentRequirementIndex],
  );
  const currentRequirementGoal = currentRequirement ? buildRequirementGoal(currentRequirement) : '';

  const startRequirement = useCallback(
    (
      requirementId: string,
      mode: LearnPathMode,
      options?: { progress?: LearnPathProgress; fresh?: boolean },
    ) => {
      const position = findRequirementPosition(groupedRequirementsRef.current, requirementId);
      if (!position) return;

      const progress = options?.progress;
      const restoredPlan = !options?.fresh ? parseRequirementPlanJson(progress?.lastPlanJson) : null;
      const restoredMessages = !options?.fresh
        ? parseLearnPathMessagesJson(progress?.lastMessagesJson)
        : [];
      const restoredInteraction = deriveRestoredInteraction(restoredMessages);
      const shouldRequestAi = options?.fresh ? true : restoredInteraction.requestAi;

      handledRequestNonceRef.current = shouldRequestAi ? 0 : stateRef.current.requestNonce;
      setDraft('');
      dispatch({
        type: 'START_PATH',
        chapterIndex: position.chapterIndex,
        requirementIndex: position.requirementIndex,
        chapterName: position.chapter.name,
        chapterId: position.chapter.id,
        requirementName: position.requirement.name,
        requirementId: position.requirement.id,
        mode,
        progressId: progress?.id ?? buildLearnPathProgressId(props.topicId, position.requirement.id, mode),
        plan: restoredPlan,
        stepId: !options?.fresh ? progress?.lastStepId ?? null : null,
        messages: restoredMessages,
        inputMode: restoredInteraction.inputMode,
        waitingForUser: restoredInteraction.waitingForUser,
        canContinue: restoredInteraction.canContinue,
        exercise: restoredInteraction.exercise,
        requestAi: shouldRequestAi,
      });
    },
    [props.topicId],
  );

  const resetToOverview = useCallback(() => {
    handledRequestNonceRef.current = 0;
    setDraft('');
    dispatch({ type: 'RESET_TO_OVERVIEW' });
    void loadProgress();
  }, [loadProgress]);

  const runAiRail = useCallback(
    async (requestNonce: number) => {
      dispatch({ type: 'SET_LOADING', loading: true });
      dispatch({ type: 'SET_ERROR', error: null });

      try {
        if (!mountedRef.current) return;

        const snapshot = stateRef.current;
        const groups = groupedRequirementsRef.current;
        const group = groups[snapshot.currentChapterIndex];
        const requirement = group?.requirements[snapshot.currentRequirementIndex];
        if (!snapshot.started || !snapshot.mode || !group || !requirement) return;

        const history = buildRequirementHistory(snapshot.messages, group.chapter.id, requirement.id);
        const response = await requestRequirementPlanTurn({
          mode: snapshot.activePlan ? 'turn' : 'plan',
          learningMode: snapshot.mode,
          requirementGoal: buildRequirementGoal(requirement),
          history,
          chapterContext: {
            subjectName: props.subjectName,
            topicName: props.topicName,
            chapterName: group.chapter.name,
            requirementName: requirement.name,
          },
          plan: snapshot.activePlan,
          currentStepId: snapshot.activeStepId,
        });

        const responsePlan = response.plan ?? snapshot.activePlan;
        const fallbackStepId = responsePlan?.steps[0]?.id ?? null;
        const nextStepId = response.currentStepId ?? snapshot.activeStepId ?? fallbackStepId;
        const nextStep = getActivePlanStep(responsePlan ?? null, nextStepId);
        const inputMode =
          response.exercise == null &&
          (response.expectsInput === 'single_choice' ||
            response.expectsInput === 'matching' ||
            response.expectsInput === 'free_text')
            ? 'text'
            : response.expectsInput;
        const awaitUserReply = response.awaitUserReply || inputMode !== 'none';

        if (response.plan) {
          dispatch({
            type: 'SET_REQUIREMENT_PLAN',
            plan: response.plan,
            stepId: nextStepId,
          });
        }

        const assistantMessage = {
          id: newId(),
          role: 'assistant' as const,
          content: response.message,
          chapterId: group.chapter.id,
          requirementId: requirement.id,
          stepId: nextStepId ?? undefined,
          stepType: nextStep?.type,
          messageKind: response.messageKind,
          inputMode,
          awaitUserReply,
          exercise: response.exercise,
        };

        dispatch({
          type: 'APPEND_ASSISTANT_MESSAGE',
          message: assistantMessage,
        });

        if (response.completeRequirement) {
          const completedAtMs = Date.now();
          const masteryDelta = clampMasteryDelta(response.masteryDelta ?? 0.12);
          const completedMessages = [
            ...snapshot.messages.filter(
              (message) =>
                message.chapterId === group.chapter.id && message.requirementId === requirement.id,
            ),
            assistantMessage,
          ];

          await learnPathProgressRepo.upsert({
            id: snapshot.activeProgressId ?? buildLearnPathProgressId(props.topicId, requirement.id, snapshot.mode),
            topicId: props.topicId,
            chapterId: group.chapter.id,
            requirementId: requirement.id,
            mode: snapshot.mode,
            status: 'completed',
            startedAtMs: getProgressStartedAt(snapshot.activeProgressId, progressRowsRef.current, completedAtMs),
            updatedAtMs: completedAtMs,
            completedAtMs,
            currentChapterIndex: snapshot.currentChapterIndex,
            currentRequirementIndex: snapshot.currentRequirementIndex,
            lastStepId: nextStepId ?? undefined,
            lastPlanJson: serializeRequirementPlan(responsePlan ?? null),
            lastMessagesJson: serializeLearnPathMessages(completedMessages),
          });

          await requirementRepo.update(requirement.id, {
            mastery: clampMastery(requirement.mastery + masteryDelta),
          });
          await refreshTopicCurriculum(props.topicId);
          await loadProgress();

          pushNotification({
            tone: 'success',
            title:
              snapshot.mode === 'review'
                ? 'Requirement wiederholt'
                : 'Requirement abgeschlossen',
            message: `${requirement.name}: ${formatMasteryDelta(masteryDelta)}`,
          });

          if (snapshot.mode === 'review') {
            dispatch({ type: 'RESET_TO_OVERVIEW' });
            return;
          }

          const nextPosition = getNextOpenRequirementPosition(
            groups,
            progressRowsRef.current,
            snapshot.currentChapterIndex,
            snapshot.currentRequirementIndex,
            requirement.id,
          );
          if (!nextPosition) {
            dispatch({ type: 'RESET_TO_OVERVIEW' });
            return;
          }

          dispatch({
            type: 'START_NEXT_REQUIREMENT',
            chapterIndex: nextPosition.chapterIndex,
            requirementIndex: nextPosition.requirementIndex,
            chapterName: nextPosition.chapter.name,
            chapterId: nextPosition.chapter.id,
            requirementName: nextPosition.requirement.name,
            requirementId: nextPosition.requirement.id,
            progressId: buildLearnPathProgressId(props.topicId, nextPosition.requirement.id, snapshot.mode),
            mode: snapshot.mode,
          });
          return;
        }

        dispatch({
          type: 'SET_INTERACTION_STATE',
          stepId: nextStepId,
          inputMode,
          waitingForUser: awaitUserReply,
          canContinue: !awaitUserReply && inputMode === 'none',
          exercise: response.exercise ?? null,
        });
      } catch (error) {
        dispatch({
          type: 'SET_ERROR',
          error: error instanceof Error ? error.message : 'Wissenspfad fehlgeschlagen',
        });
      } finally {
        handledRequestNonceRef.current = requestNonce;
        if (mountedRef.current) dispatch({ type: 'SET_LOADING', loading: false });
      }
    },
    [loadProgress, props.subjectName, props.topicId, props.topicName, pushNotification, refreshTopicCurriculum],
  );

  useEffect(() => {
    if (!state.started || state.requestNonce === 0) return;
    if (state.loading) return;
    if (handledRequestNonceRef.current === state.requestNonce) return;
    void runAiRail(state.requestNonce);
  }, [runAiRail, state.loading, state.requestNonce, state.started]);

  useEffect(() => {
    if (
      !state.started ||
      !state.mode ||
      !state.activeProgressId ||
      !currentChapter ||
      !currentRequirement ||
      state.pathCompleted
    ) {
      return;
    }

    const now = Date.now();
    const messages = state.messages.filter(
      (message) =>
        message.chapterId === currentChapter.id && message.requirementId === currentRequirement.id,
    );
    const startedAtMs = getProgressStartedAt(state.activeProgressId, progressRowsRef.current, now);

    const nextRow: LearnPathProgress = {
      id: state.activeProgressId,
      topicId: props.topicId,
      chapterId: currentChapter.id,
      requirementId: currentRequirement.id,
      mode: state.mode,
      status: 'in_progress',
      startedAtMs,
      updatedAtMs: now,
      currentChapterIndex: state.currentChapterIndex,
      currentRequirementIndex: state.currentRequirementIndex,
      lastStepId: state.activeStepId ?? undefined,
      lastPlanJson: serializeRequirementPlan(state.activePlan),
      lastMessagesJson: serializeLearnPathMessages(messages),
    };

    void learnPathProgressRepo.upsert(nextRow).then((row) => {
      if (!mountedRef.current) return;
      setProgressRows((current) => upsertProgressRow(current, row));
    });
  }, [
    currentChapter,
    currentRequirement,
    props.topicId,
    state.activePlan,
    state.activeProgressId,
    state.activeStepId,
    state.currentChapterIndex,
    state.currentRequirementIndex,
    state.messages,
    state.mode,
    state.pathCompleted,
    state.started,
  ]);

  const appendUserResponse = useCallback(
    (response: LearnPathTurnResponse, content: string) => {
      if (
        state.loading ||
        !state.waitingForUser ||
        !currentChapter ||
        !currentRequirement ||
        !state.activeStepId
      ) {
        return;
      }

      dispatch({
        type: 'APPEND_USER_MESSAGE',
        chapterId: currentChapter.id,
        requirementId: currentRequirement.id,
        content,
        stepId: state.activeStepId,
        stepType: activeStep?.type,
        response,
      });
      dispatch({ type: 'REQUEST_AI' });
      setDraft('');
    },
    [
      activeStep?.type,
      currentChapter,
      currentRequirement,
      state.activeStepId,
      state.loading,
      state.waitingForUser,
    ],
  );

  const handleSend = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (
      state.inputMode !== 'text' &&
      state.inputMode !== 'free_text' &&
      !(state.waitingForUser && !state.pendingExercise)
    ) {
      return;
    }

    appendUserResponse(
      { kind: state.inputMode === 'free_text' ? 'free_text' : 'text', text: trimmed },
      trimmed,
    );
  }, [appendUserResponse, draft, state.inputMode, state.pendingExercise, state.waitingForUser]);

  const handleExerciseSubmit = useCallback(
    (response: LearnPathTurnResponse, exercise: LearnPathExercise | null) => {
      appendUserResponse(response, describeResponse(response, exercise));
    },
    [appendUserResponse],
  );

  const handleContinue = useCallback(() => {
    if (state.loading || !state.canContinue) return;
    dispatch({ type: 'REQUEST_AI' });
  }, [state.canContinue, state.loading]);

  const handleRestart = useCallback(() => {
    if (!currentRequirement || !state.mode) return;
    startRequirement(currentRequirement.id, state.mode, { fresh: true });
  }, [currentRequirement, startRequirement, state.mode]);

  const handleResumeLatest = useCallback(() => {
    if (!latestInProgress) return;
    startRequirement(latestInProgress.requirementId, latestInProgress.mode, {
      progress: latestInProgress,
    });
  }, [latestInProgress, startRequirement]);

  const handleStartOverviewItem = useCallback(
    (item: LearnPathRequirementOverviewItem, mode: LearnPathMode) => {
      const progress =
        mode === 'learn' && item.learnProgress?.status === 'in_progress'
          ? item.learnProgress
          : mode === 'review' && item.reviewProgress?.status === 'in_progress'
            ? item.reviewProgress
            : undefined;
      startRequirement(item.requirement.id, mode, { progress, fresh: !progress });
    },
    [startRequirement],
  );

  return {
    curriculumLoading,
    curriculumError,
    progressLoading: state.progressLoading,
    draft,
    setDraft,
    state,
    progressRows,
    groupedRequirements,
    overviewItems,
    latestInProgress,
    firstOpenRequirement,
    totalRequirements,
    currentGroup,
    currentChapter,
    currentRequirement,
    activeStep,
    currentRequirementPosition,
    currentRequirementGoal,
    handleExerciseSubmit,
    handleSend,
    handleContinue,
    handleRestart,
    handleResumeLatest,
    handleStartOverviewItem,
    resetToOverview,
  };
}

function findRequirementPosition(groups: LearnPathGroup[], requirementId: string) {
  for (let chapterIndex = 0; chapterIndex < groups.length; chapterIndex += 1) {
    const group = groups[chapterIndex];
    const requirementIndex = group.requirements.findIndex((item) => item.id === requirementId);
    if (requirementIndex >= 0) {
      return {
        chapterIndex,
        requirementIndex,
        chapter: group.chapter,
        requirement: group.requirements[requirementIndex],
      };
    }
  }
  return null;
}

function buildLearnPathProgressId(topicId: string, requirementId: string, mode: LearnPathMode) {
  return `${topicId}:${requirementId}:${mode}`;
}

function getProgressStartedAt(progressId: string | null, rows: LearnPathProgress[], fallback: number) {
  if (!progressId) return fallback;
  return rows.find((row) => row.id === progressId)?.startedAtMs ?? fallback;
}

function upsertProgressRow(rows: LearnPathProgress[], nextRow: LearnPathProgress) {
  const filtered = rows.filter((row) => row.id !== nextRow.id);
  return [nextRow, ...filtered].sort((a, b) => b.updatedAtMs - a.updatedAtMs);
}

function getNextOpenRequirementPosition(
  groups: LearnPathGroup[],
  progressRows: LearnPathProgress[],
  currentChapterIndex: number,
  currentRequirementIndex: number,
  completedRequirementId: string,
) {
  const completedLearnRequirementIds = new Set(
    progressRows
      .filter((row) => row.mode === 'learn' && row.status === 'completed')
      .map((row) => row.requirementId),
  );
  completedLearnRequirementIds.add(completedRequirementId);

  for (let chapterIndex = currentChapterIndex; chapterIndex < groups.length; chapterIndex += 1) {
    const requirementStartIndex = chapterIndex === currentChapterIndex ? currentRequirementIndex + 1 : 0;
    for (
      let requirementIndex = requirementStartIndex;
      requirementIndex < groups[chapterIndex].requirements.length;
      requirementIndex += 1
    ) {
      const requirement = groups[chapterIndex].requirements[requirementIndex];
      if (completedLearnRequirementIds.has(requirement.id)) continue;
      return {
        chapterIndex,
        requirementIndex,
        chapter: groups[chapterIndex].chapter,
        requirement,
      };
    }
  }
  return null;
}

function deriveRestoredInteraction(messages: LearnPathState['messages']) {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage) {
    return {
      inputMode: 'none' as const,
      waitingForUser: false,
      canContinue: false,
      exercise: null,
      requestAi: true,
    };
  }

  if (lastMessage.role === 'user') {
    return {
      inputMode: 'none' as const,
      waitingForUser: false,
      canContinue: false,
      exercise: null,
      requestAi: true,
    };
  }

  if (lastMessage.role === 'assistant') {
    const inputMode =
      !lastMessage.exercise &&
      (lastMessage.inputMode === 'single_choice' ||
        lastMessage.inputMode === 'matching' ||
        lastMessage.inputMode === 'free_text')
        ? 'text'
        : (lastMessage.inputMode ?? 'none');
    const waitingForUser = lastMessage.awaitUserReply === true;
    return {
      inputMode,
      waitingForUser,
      canContinue: !waitingForUser && inputMode === 'none',
      exercise: lastMessage.exercise ?? null,
      requestAi: false,
    };
  }

  return {
    inputMode: 'none' as const,
    waitingForUser: false,
    canContinue: false,
    exercise: null,
    requestAi: true,
  };
}
