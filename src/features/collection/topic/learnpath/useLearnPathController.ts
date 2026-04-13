import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  Chapter,
  LearnPathMode,
  LearnPathProgress,
  Requirement,
} from '../../../../domain/models';
import { newId } from '../../../../lib/id';
import {
  flashcardRepo,
  learnPathProgressRepo,
  learnPathSessionRequirementRepo,
  requirementRepo,
  studySessionRepo,
} from '../../../../repositories';
import { useCurriculumStore } from '../../../../stores/curriculumStore';
import { useActiveSessionStore } from '../../../../stores/activeSessionStore';
import { useNotificationsStore } from '../../../../stores/notificationsStore';
import { useAssetsStore } from '../../../../stores/assetsStore';
import { useStudyStore } from '../../../session/stores/studyStore';
import { createInitialFlashcardSchedule } from '../flashcards/flashcardSrs';
import { generateRequirementCheatsheet } from './ai/requirementCheatsheetAiClient';
import { generateRequirementFlashcards } from './ai/requirementFlashcardAiClient';
import { scanRequirementMaterial } from './ai/requirementMaterialScanAiClient';
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
  deriveInteractionFromAssistantTurn,
  expectedExerciseTypeFromInputMode,
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
  type LearnPathPanelView,
  type LearnPathRequirementOverviewItem,
  type LearnPathState,
  type LearnPathTurnResponse,
} from './types';

const EMPTY_CHAPTERS: Chapter[] = [];
const EMPTY_REQUIREMENTS: Requirement[] = [];

type GeneratedRequirementFlashcard = {
  id: string;
  front: string;
  back: string;
  chapterId?: string;
  requirementId?: string;
};

type MaterialScanResult = {
  requirementId: string;
  summary: string;
  sourceName?: string;
};

type GeneratedRequirementCheatsheet = {
  title: string;
  content: string;
  chapterId?: string;
  requirementId?: string;
};

export function useLearnPathController(props: {
  subjectId: string;
  topicId: string;
  topicName?: string;
  subjectName?: string;
}) {
  const navigate = useNavigate();
  const refreshTopicCurriculum = useCurriculumStore((s) => s.refreshTopicCurriculum);
  const chapters = useCurriculumStore((s) => s.chaptersByTopic[props.topicId] ?? EMPTY_CHAPTERS);
  const requirements = useCurriculumStore((s) => s.requirementsByTopic[props.topicId] ?? EMPTY_REQUIREMENTS);
  const curriculumLoading = useCurriculumStore((s) => s.loadingByTopic[props.topicId] ?? false);
  const curriculumError = useCurriculumStore((s) => s.errorByTopic[props.topicId]);
  const pushNotification = useNotificationsStore((s) => s.push);
  const uploadAssetWithFile = useAssetsStore((s) => s.createWithFile);
  const refreshAssetsByTopic = useAssetsStore((s) => s.refreshByTopic);
  const activeSession = useActiveSessionStore((s) => s.active);
  const startActiveSession = useActiveSessionStore((s) => s.start);
  const endActiveSession = useActiveSessionStore((s) => s.end);
  const bindToSession = useStudyStore((s) => s.bindToSession);
  const ensureStudySession = useStudyStore((s) => s.ensureStudySession);
  const resetStudyStore = useStudyStore((s) => s.reset);
  const studySessionId = useStudyStore((s) => s.studySessionId);

  const [draft, setDraft] = useState('');
  const [progressRows, setProgressRows] = useState<LearnPathProgress[]>([]);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [leaveDialogBusy, setLeaveDialogBusy] = useState(false);
  const [generatedFlashcards, setGeneratedFlashcards] = useState<GeneratedRequirementFlashcard[]>([]);
  const [generatedCheatsheet, setGeneratedCheatsheet] = useState<GeneratedRequirementCheatsheet | null>(
    null,
  );
  const [completionBusy, setCompletionBusy] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [materialLastMatches, setMaterialLastMatches] = useState<MaterialScanResult[]>([]);
  const [materialBusy, setMaterialBusy] = useState(false);
  const [materialError, setMaterialError] = useState<string | null>(null);
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
  const completedProgressIdsRef = useRef(new Set<string>());
  const studySessionIdRef = useRef<string | null>(studySessionId);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    progressRowsRef.current = progressRows;
  }, [progressRows]);

  useEffect(() => {
    studySessionIdRef.current = studySessionId;
  }, [studySessionId]);

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
    completedProgressIdsRef.current = new Set();
    setDraft('');
    setProgressRows([]);
    setGeneratedFlashcards([]);
    setGeneratedCheatsheet(null);
    setCompletionBusy(false);
    setCompletionError(null);
    setMaterialLastMatches([]);
    setMaterialBusy(false);
    setMaterialError(null);
    dispatch({ type: 'RESET_TO_OVERVIEW' });

    const store = useCurriculumStore.getState();
    const alreadyLoaded = (store.chaptersByTopic[props.topicId]?.length ?? 0) > 0;
    const isLoading = store.loadingByTopic[props.topicId] ?? false;
    if (!alreadyLoaded && !isLoading) void refreshTopicCurriculum(props.topicId);
    void loadProgress();
  }, [loadProgress, props.topicId, refreshTopicCurriculum]);

  useEffect(() => {
    if (!state.started) return;
    if (!activeSession) return;
    if (activeSession.subjectId !== props.subjectId || activeSession.topicId !== props.topicId) return;
    bindToSession({
      subjectId: activeSession.subjectId,
      topicId: activeSession.topicId,
      startedAtMs: activeSession.startedAtMs,
    });
    void ensureStudySession({
      subjectId: activeSession.subjectId,
      topicId: activeSession.topicId,
      startedAtMs: activeSession.startedAtMs,
      plannedDurationMs: activeSession.plannedDurationMs,
      source: 'learnpath',
    });
  }, [activeSession, bindToSession, ensureStudySession, props.subjectId, props.topicId, state.started]);

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
  const nextRequirementAvailable = useMemo(
    () =>
      Boolean(
        currentRequirement &&
          getNextOpenRequirementPosition(
            groupedRequirements,
            progressRows,
            state.currentChapterIndex,
            state.currentRequirementIndex,
            currentRequirement.id,
          ),
      ),
    [
      currentRequirement,
      groupedRequirements,
      progressRows,
      state.currentChapterIndex,
      state.currentRequirementIndex,
    ],
  );

  const ensureActiveTopicSession = useCallback(async () => {
    const currentActive = useActiveSessionStore.getState().active;
    if (
      !currentActive ||
      currentActive.subjectId !== props.subjectId ||
      currentActive.topicId !== props.topicId
    ) {
      if (currentActive) {
        endActiveSession();
        resetStudyStore();
      }
      startActiveSession({
        subjectId: props.subjectId,
        topicId: props.topicId,
      });
    }
    const nextActive = useActiveSessionStore.getState().active;
    if (!nextActive) return null;
    bindToSession({
      subjectId: nextActive.subjectId,
      topicId: nextActive.topicId,
      startedAtMs: nextActive.startedAtMs,
    });
    return ensureStudySession({
      subjectId: nextActive.subjectId,
      topicId: nextActive.topicId,
      startedAtMs: nextActive.startedAtMs,
      plannedDurationMs: nextActive.plannedDurationMs,
      source: 'learnpath',
    });
  }, [
    bindToSession,
    endActiveSession,
    ensureStudySession,
    props.subjectId,
    props.topicId,
    resetStudyStore,
    startActiveSession,
  ]);

  const startRequirement = useCallback(
    async (
      requirementId: string,
      mode: LearnPathMode,
      options?: { progress?: LearnPathProgress; fresh?: boolean },
    ) => {
      await ensureActiveTopicSession();
      const position = findRequirementPosition(groupedRequirementsRef.current, requirementId);
      if (!position) return;

      const progress = options?.progress;
      const restoredPlan = !options?.fresh ? parseRequirementPlanJson(progress?.lastPlanJson) : null;
      const restoredMessages = !options?.fresh
        ? parseLearnPathMessagesJson(progress?.lastMessagesJson)
        : [];
      const restoredInteraction = deriveRestoredInteraction(restoredMessages);
      const shouldRequestAi = options?.fresh ? true : restoredInteraction.requestAi;
      const progressId =
        progress?.id ?? buildLearnPathProgressId(props.topicId, position.requirement.id, mode);

      handledRequestNonceRef.current = shouldRequestAi ? 0 : stateRef.current.requestNonce;
      completedProgressIdsRef.current.delete(progressId);
      setDraft('');
      setGeneratedFlashcards([]);
      setGeneratedCheatsheet(null);
      setCompletionBusy(false);
      setCompletionError(null);
      dispatch({
        type: 'START_PATH',
        chapterIndex: position.chapterIndex,
        requirementIndex: position.requirementIndex,
        chapterName: position.chapter.name,
        chapterId: position.chapter.id,
        requirementName: position.requirement.name,
        requirementId: position.requirement.id,
        mode,
        progressId,
        plan: restoredPlan,
        stepId: !options?.fresh ? progress?.lastStepId ?? null : null,
        messages: restoredMessages,
        inputMode: restoredInteraction.inputMode,
        interactionSurface: restoredInteraction.interactionSurface,
        waitingForUser: restoredInteraction.waitingForUser,
        canContinue: restoredInteraction.canContinue,
        exerciseState: restoredInteraction.exerciseState,
        requestAi: shouldRequestAi,
      });
    },
    [ensureActiveTopicSession, props.topicId],
  );

  const resetToOverview = useCallback(() => {
    handledRequestNonceRef.current = 0;
    setDraft('');
    setGeneratedFlashcards([]);
    setGeneratedCheatsheet(null);
    setCompletionBusy(false);
    setCompletionError(null);
    setMaterialLastMatches([]);
    setMaterialError(null);
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
        const requirementContext = {
          materialContext: requirement.materialContext?.trim() || undefined,
        };
        const response = await requestRequirementPlanTurn({
          mode: snapshot.activePlan ? 'turn' : 'plan',
          learningMode: snapshot.mode,
          requirementGoal: buildRequirementGoal(requirement),
          requirementContext,
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
        const inputMode = response.expectsInput;
        const interaction = deriveInteractionFromAssistantTurn({
          inputMode,
          awaitUserReply: response.awaitUserReply,
          exerciseState: response.exerciseState,
        });

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
          interactionSurface: interaction.interactionSurface,
          inputMode,
          awaitUserReply: interaction.waitingForUser,
          exercise: response.exerciseState.exercise ?? undefined,
        };

        dispatch({
          type: 'APPLY_ASSISTANT_TURN',
          message: assistantMessage,
          stepId: nextStepId,
          interactionSurface: interaction.interactionSurface,
          inputMode,
          waitingForUser: interaction.waitingForUser,
          canContinue: interaction.canContinue,
          exerciseState: response.exerciseState,
        });

        if (response.completeRequirement) {
          const completedAtMs = Date.now();
          const masteryDelta = clampMasteryDelta(response.masteryDelta ?? 0.12);
          const progressId =
            snapshot.activeProgressId ??
            buildLearnPathProgressId(props.topicId, requirement.id, snapshot.mode);
          const startedAtMs = getProgressStartedAt(
            snapshot.activeProgressId,
            progressRowsRef.current,
            completedAtMs,
          );
          const completedMessages = [
            ...snapshot.messages.filter(
              (message) =>
                message.chapterId === group.chapter.id && message.requirementId === requirement.id,
            ),
            assistantMessage,
          ];

          await learnPathProgressRepo.upsert({
            id: progressId,
            topicId: props.topicId,
            chapterId: group.chapter.id,
            requirementId: requirement.id,
            mode: snapshot.mode,
            status: 'completed',
            startedAtMs,
            updatedAtMs: completedAtMs,
            completedAtMs,
            currentChapterIndex: snapshot.currentChapterIndex,
            currentRequirementIndex: snapshot.currentRequirementIndex,
            lastStepId: nextStepId ?? undefined,
            lastPlanJson: serializeRequirementPlan(responsePlan ?? null),
            lastMessagesJson: serializeLearnPathMessages(completedMessages),
          });
          const completedRow: LearnPathProgress = {
            id: progressId,
            topicId: props.topicId,
            chapterId: group.chapter.id,
            requirementId: requirement.id,
            mode: snapshot.mode,
            status: 'completed',
            startedAtMs,
            updatedAtMs: completedAtMs,
            completedAtMs,
            currentChapterIndex: snapshot.currentChapterIndex,
            currentRequirementIndex: snapshot.currentRequirementIndex,
            lastStepId: nextStepId ?? undefined,
            lastPlanJson: serializeRequirementPlan(responsePlan ?? null),
            lastMessagesJson: serializeLearnPathMessages(completedMessages),
          };
          completedProgressIdsRef.current.add(progressId);
          if (mountedRef.current) {
            setProgressRows((current) => upsertProgressRow(current, completedRow));
          }
          if (studySessionIdRef.current) {
            await learnPathSessionRequirementRepo.upsert({
              studySessionId: studySessionIdRef.current,
              topicId: props.topicId,
              chapterId: group.chapter.id,
              chapterName: group.chapter.name,
              requirementId: requirement.id,
              requirementName: requirement.name,
              mode: snapshot.mode,
              status: 'completed',
              startedAtMs,
              completedAtMs,
              durationMs: Math.max(0, completedAtMs - startedAtMs),
              masteryDelta,
              aiSummary: buildRequirementSessionSummary(completedMessages),
              messageCount: completedMessages.length,
            });
          }

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
          setGeneratedFlashcards([]);
          setGeneratedCheatsheet(null);
          setCompletionError(null);
          setCompletionBusy(false);
          dispatch({ type: 'SHOW_COMPLETION_PROMPT', prompt: 'next_action' });
          return;
        }

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
    if (state.activeProgressId && completedProgressIdsRef.current.has(state.activeProgressId)) {
      return;
    }
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

  useEffect(() => {
    if (
      !state.started ||
      !state.mode ||
      !studySessionId ||
      !currentChapter ||
      !currentRequirement ||
      state.pathCompleted
    ) {
      return;
    }
    const startedAtMs = getProgressStartedAt(state.activeProgressId, progressRowsRef.current, Date.now());
    const now = Date.now();
    const requirementMessages = state.messages.filter(
      (message) =>
        message.chapterId === currentChapter.id && message.requirementId === currentRequirement.id,
    );
    void learnPathSessionRequirementRepo.upsert({
      studySessionId,
      topicId: props.topicId,
      chapterId: currentChapter.id,
      chapterName: currentChapter.name,
      requirementId: currentRequirement.id,
      requirementName: currentRequirement.name,
      mode: state.mode,
      status: 'in_progress',
      startedAtMs,
      completedAtMs: undefined,
      durationMs: Math.max(0, now - startedAtMs),
      messageCount: requirementMessages.length,
    });
  }, [
    currentChapter,
    currentRequirement,
    props.topicId,
    state.activeProgressId,
    state.messages,
    state.mode,
    state.pathCompleted,
    state.started,
    studySessionId,
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
      state.inputMode !== 'quiz' &&
      !(state.waitingForUser && state.exerciseState.status !== 'ready')
    ) {
      return;
    }

    appendUserResponse(
      { kind: state.inputMode === 'free_text' ? 'free_text' : 'text', text: trimmed },
      trimmed,
    );
  }, [appendUserResponse, draft, state.exerciseState.status, state.inputMode, state.waitingForUser]);

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
    void startRequirement(currentRequirement.id, state.mode, { fresh: true });
  }, [currentRequirement, startRequirement, state.mode]);

  const handleResumeLatest = useCallback(() => {
    if (!latestInProgress) return;
    void startRequirement(latestInProgress.requirementId, latestInProgress.mode, {
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
      void startRequirement(item.requirement.id, mode, { progress, fresh: !progress });
    },
    [startRequirement],
  );

  const setPanelOpen = useCallback((open: boolean) => {
    dispatch({ type: 'SET_PANEL_OPEN', open });
  }, []);

  const setPanelView = useCallback((view: LearnPathPanelView) => {
    dispatch({ type: 'SET_PANEL_VIEW', view });
  }, []);

  const handleBack = useCallback(() => {
    setLeaveDialogOpen(true);
  }, []);

  const handleLeavePage = useCallback(() => {
    setLeaveDialogOpen(false);
    navigate(`/subjects/${props.subjectId}/topics/${props.topicId}`);
  }, [navigate, props.subjectId, props.topicId]);

  const handleEndSession = useCallback(async () => {
    setLeaveDialogBusy(true);
    try {
      const active = useActiveSessionStore.getState().active;
      const activeStudySessionId = useStudyStore.getState().studySessionId;
      const endedAtMs = Date.now();
      if (activeStudySessionId) {
        await studySessionRepo.end(activeStudySessionId, endedAtMs);
      }
      endActiveSession();
      resetStudyStore();
      handledRequestNonceRef.current = 0;
      setLeaveDialogOpen(false);
      dispatch({ type: 'RESET_TO_OVERVIEW' });
      navigate(`/subjects/${props.subjectId}/topics/${props.topicId}`, {
        state: {
          sessionSummary: {
            studySessionId: activeStudySessionId ?? undefined,
            subjectId: props.subjectId,
            topicId: props.topicId,
            startedAtMs: active?.startedAtMs ?? endedAtMs,
            endedAtMs,
            source: 'learnpath' as const,
          },
        },
      });
    } finally {
      if (mountedRef.current) setLeaveDialogBusy(false);
    }
  }, [endActiveSession, navigate, props.subjectId, props.topicId, resetStudyStore]);

  const handleGenerateFlashcards = useCallback(async () => {
    if (!currentChapter || !currentRequirement) return;
    setCompletionBusy(true);
    setCompletionError(null);
    try {
      const snapshot = stateRef.current;
      const drafts = await generateRequirementFlashcards({
        requirementGoal: buildRequirementGoal(currentRequirement),
        requirementContext: {
          materialContext: currentRequirement.materialContext?.trim() || undefined,
        },
        history: buildRequirementHistory(snapshot.messages, currentChapter.id, currentRequirement.id),
        chapterContext: {
          subjectName: props.subjectName,
          topicName: props.topicName,
          chapterName: currentChapter.name,
          requirementName: currentRequirement.name,
        },
      });
      setGeneratedFlashcards(
        drafts.map((draft) => ({
          id: newId(),
          front: draft.front,
          back: draft.back,
          chapterId: currentChapter.id,
          requirementId: currentRequirement.id,
        })),
      );
      dispatch({ type: 'SHOW_COMPLETION_PROMPT', prompt: 'after_generation' });
    } catch (generationError) {
      setCompletionError(
        generationError instanceof Error
          ? generationError.message
          : 'Karteikarten konnten nicht erzeugt werden',
      );
    } finally {
      if (mountedRef.current) setCompletionBusy(false);
    }
  }, [
    currentChapter,
    currentRequirement,
    props.subjectName,
    props.topicName,
  ]);

  const updateGeneratedFlashcard = useCallback(
    (
      flashcardId: string,
      patch: Partial<Pick<GeneratedRequirementFlashcard, 'front' | 'back' | 'chapterId' | 'requirementId'>>,
    ) => {
      setGeneratedFlashcards((current) =>
        current.map((entry) => {
          if (entry.id !== flashcardId) return entry;
          const nextChapterId = patch.chapterId !== undefined ? patch.chapterId : entry.chapterId;
          const nextRequirementId =
            patch.requirementId !== undefined ? patch.requirementId : entry.requirementId;
          const requirementStillMatches =
            !nextRequirementId ||
            requirements.find(
              (requirement) =>
                requirement.id === nextRequirementId &&
                (!nextChapterId || requirement.chapterId === nextChapterId),
            );
          return {
            ...entry,
            ...patch,
            chapterId: nextChapterId,
            requirementId: requirementStillMatches ? nextRequirementId : undefined,
          };
        }),
      );
    },
    [requirements],
  );

  const handleGenerateCheatsheet = useCallback(async () => {
    if (!currentChapter || !currentRequirement) return;
    setCompletionBusy(true);
    setCompletionError(null);
    try {
      const snapshot = stateRef.current;
      const draft = await generateRequirementCheatsheet({
        requirementGoal: buildRequirementGoal(currentRequirement),
        requirementContext: {
          materialContext: currentRequirement.materialContext?.trim() || undefined,
        },
        history: buildRequirementHistory(snapshot.messages, currentChapter.id, currentRequirement.id),
        chapterContext: {
          subjectName: props.subjectName,
          topicName: props.topicName,
          chapterName: currentChapter.name,
          requirementName: currentRequirement.name,
        },
      });
      const fallbackTitle = `Merkblatt: ${currentRequirement.name}`;
      setGeneratedCheatsheet({
        title: draft.title?.trim() || fallbackTitle,
        content: draft.content,
        chapterId: currentChapter.id,
        requirementId: currentRequirement.id,
      });
      dispatch({ type: 'SHOW_COMPLETION_PROMPT', prompt: 'after_generation' });
    } catch (generationError) {
      setCompletionError(
        generationError instanceof Error
          ? generationError.message
          : 'Merkblatt konnte nicht erzeugt werden',
      );
    } finally {
      if (mountedRef.current) setCompletionBusy(false);
    }
  }, [currentChapter, currentRequirement, props.subjectName, props.topicName]);

  const handleSaveGeneratedFlashcards = useCallback(async () => {
    if (generatedFlashcards.length === 0) return;
    setCompletionBusy(true);
    setCompletionError(null);
    try {
      const now = Date.now();
      await flashcardRepo.bulkUpsert(
        generatedFlashcards
          .filter((card) => card.front.trim() && card.back.trim())
          .map((card) => ({
            subjectId: props.subjectId,
            topicId: props.topicId,
            chapterId: card.chapterId,
            requirementId: card.requirementId,
            front: card.front,
            back: card.back,
            source: 'ai_requirement',
            state: 'active',
            ...createInitialFlashcardSchedule(now),
          })),
      );
      setGeneratedFlashcards([]);
      dispatch({ type: 'SHOW_COMPLETION_PROMPT', prompt: 'after_generation' });
      pushNotification({
        tone: 'success',
        title: 'Karteikarten gespeichert',
        message: 'Die neuen Karten sind im Topic verfuegbar.',
      });
    } catch (saveError) {
      setCompletionError(
        saveError instanceof Error ? saveError.message : 'Karteikarten konnten nicht gespeichert werden',
      );
    } finally {
      if (mountedRef.current) setCompletionBusy(false);
    }
  }, [generatedFlashcards, props.subjectId, props.topicId, pushNotification]);

  const handleSaveGeneratedCheatsheet = useCallback(async () => {
    if (!generatedCheatsheet) return;
    const content = generatedCheatsheet.content.trim();
    if (!content) return;
    setCompletionBusy(true);
    setCompletionError(null);
    try {
      const safeBase = (generatedCheatsheet.title || 'merkblatt')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64);
      const fileName = `${safeBase || 'merkblatt'}.md`;
      const file = new File([content], fileName, { type: 'text/markdown;charset=utf-8' });
      await uploadAssetWithFile({
        subjectId: props.subjectId,
        topicId: props.topicId,
        type: 'cheatsheet',
        title: generatedCheatsheet.title,
        file,
      });
      setGeneratedCheatsheet(null);
      dispatch({ type: 'SHOW_COMPLETION_PROMPT', prompt: 'after_generation' });
      pushNotification({
        tone: 'success',
        title: 'Merkblatt gespeichert',
        message: 'Das Merkblatt ist jetzt in den Topic-Assets verfuegbar.',
      });
    } catch (saveError) {
      setCompletionError(
        saveError instanceof Error ? saveError.message : 'Merkblatt konnte nicht gespeichert werden',
      );
    } finally {
      if (mountedRef.current) setCompletionBusy(false);
    }
  }, [generatedCheatsheet, props.subjectId, props.topicId, pushNotification, uploadAssetWithFile]);

  const handleScanMaterialFiles = useCallback(
    async (files: File[]) => {
      const pdfFiles = files.filter(
        (file) =>
          file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'),
      );
      if (pdfFiles.length === 0) {
        setMaterialError('Bitte mindestens eine PDF-Datei auswählen.');
        return;
      }
      setMaterialBusy(true);
      setMaterialError(null);
      try {
        const matches = await scanRequirementMaterial({
          subjectName: props.subjectName,
          topicName: props.topicName,
          files: pdfFiles,
          targets: groupedRequirementsRef.current.flatMap((group) =>
            group.requirements.map((requirement) => ({
              requirementId: requirement.id,
              requirementName: requirement.name,
              chapterName: group.chapter.name,
              description: requirement.description,
            })),
          ),
        });

        const sourceAssetIdByName = new Map<string, string>();
        for (const file of pdfFiles) {
          const createdAsset = await uploadAssetWithFile({
            subjectId: props.subjectId,
            topicId: props.topicId,
            type: 'file',
            title: `Unterrichtsmaterial: ${file.name}`,
            file,
          });
          sourceAssetIdByName.set(file.name, createdAsset.id);
        }

        const requirementById = new Map(
          groupedRequirementsRef.current.flatMap((group) => group.requirements.map((item) => [item.id, item])),
        );

        const appliedMatches: MaterialScanResult[] = [];
        for (const match of matches) {
          const requirement = requirementById.get(match.requirementId);
          if (!requirement) continue;
          const sourceName = match.sourceName?.trim() || 'unbekannte PDF';
          const sourceAssetId = sourceAssetIdByName.get(sourceName);
          if (!sourceAssetId) continue;
          const appendedText = match.summary.trim();
          if (!appendedText) continue;

          const existingSources = requirement.materialContextSources ?? [];
          const alreadyExists = existingSources.some(
            (entry) => entry.sourceName === sourceName && entry.appendedText === appendedText,
          );
          if (alreadyExists) continue;

          const nextMaterialContext = appendMaterialContext(requirement.materialContext, {
            sourceName,
            appendedText,
          });
          const nextSourceEntry = {
            id: newId(),
            sourceAssetId,
            sourceName,
            appendedText,
            appendedAtMs: Date.now(),
          };

          await requirementRepo.update(requirement.id, {
            materialContext: nextMaterialContext,
            materialContextSources: [...existingSources, nextSourceEntry],
          });

          requirementById.set(requirement.id, {
            ...requirement,
            materialContext: nextMaterialContext,
            materialContextSources: [...existingSources, nextSourceEntry],
          });
          appliedMatches.push({
            requirementId: requirement.id,
            summary: appendedText,
            sourceName,
          });
        }

        await refreshTopicCurriculum(props.topicId);
        await refreshAssetsByTopic(props.topicId);
        setMaterialLastMatches(appliedMatches);
        pushNotification({
          tone: 'success',
          title: 'Unterrichtsmaterial verarbeitet',
          message:
            appliedMatches.length > 0
              ? `${appliedMatches.length} Requirement-Kontexte wurden erweitert.`
              : 'Es wurden keine neuen Requirement-Kontexte ergänzt.',
        });
      } catch (scanError) {
        setMaterialError(
          scanError instanceof Error
            ? scanError.message
            : 'Unterrichtsmaterial konnte nicht analysiert werden',
        );
      } finally {
        if (mountedRef.current) setMaterialBusy(false);
      }
    },
    [
      props.subjectId,
      props.subjectName,
      props.topicId,
      props.topicName,
      pushNotification,
      refreshAssetsByTopic,
      refreshTopicCurriculum,
      uploadAssetWithFile,
    ],
  );

  const handleCompletionContinue = useCallback(() => {
    if (!currentRequirement || !state.mode) return;
    setGeneratedFlashcards([]);
    setGeneratedCheatsheet(null);
    setCompletionBusy(false);
    setCompletionError(null);
    dispatch({ type: 'CLEAR_COMPLETION_PROMPT' });
    const nextPosition = getNextOpenRequirementPosition(
      groupedRequirementsRef.current,
      progressRowsRef.current,
      state.currentChapterIndex,
      state.currentRequirementIndex,
      currentRequirement.id,
    );
    if (!nextPosition) {
      dispatch({ type: 'COMPLETE_PATH' });
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
      progressId: buildLearnPathProgressId(props.topicId, nextPosition.requirement.id, state.mode),
      mode: state.mode,
    });
  }, [
    currentRequirement,
    props.topicId,
    state.currentChapterIndex,
    state.currentRequirementIndex,
    state.mode,
  ]);

  return {
    curriculumLoading,
    curriculumError,
    progressLoading: state.progressLoading,
    draft,
    setDraft,
    state,
    progressRows,
    groupedRequirements,
    chapters,
    requirements,
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
    nextRequirementAvailable,
    generatedFlashcards,
    generatedCheatsheet,
    materialLastMatches,
    materialBusy,
    materialError,
    completionBusy,
    completionError,
    leaveDialogOpen,
    leaveDialogBusy,
    setLeaveDialogOpen,
    handleExerciseSubmit,
    handleSend,
    handleContinue,
    handleRestart,
    handleResumeLatest,
    handleStartOverviewItem,
    handleGenerateFlashcards,
    handleGenerateCheatsheet,
    handleScanMaterialFiles,
    updateGeneratedFlashcard,
    handleSaveGeneratedFlashcards,
    handleSaveGeneratedCheatsheet,
    handleCompletionContinue,
    handleBack,
    handleLeavePage,
    handleEndSession,
    setPanelOpen,
    setPanelView,
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

function appendMaterialContext(
  existing: string | undefined,
  input: { sourceName: string; appendedText: string },
) {
  const base = existing?.trim();
  const block = `[Quelle: ${input.sourceName}]\n${input.appendedText.trim()}`;
  return base ? `${base}\n\n${block}` : block;
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
      interactionSurface: 'idle' as const,
      inputMode: 'none' as const,
      waitingForUser: false,
      canContinue: false,
      exerciseState: {
        status: 'idle' as const,
        exercise: null,
        expectedType: null,
      },
      requestAi: true,
    };
  }

  if (lastMessage.role === 'user') {
    return {
      interactionSurface: 'idle' as const,
      inputMode: 'none' as const,
      waitingForUser: false,
      canContinue: false,
      exerciseState: {
        status: 'idle' as const,
        exercise: null,
        expectedType: null,
      },
      requestAi: true,
    };
  }

  if (lastMessage.role === 'assistant') {
    const inputMode = lastMessage.inputMode ?? 'none';
    const expectedType = expectedExerciseTypeFromInputMode(inputMode);
    const exerciseState = {
      status: lastMessage.exercise ? ('ready' as const) : expectedType ? ('missing' as const) : ('idle' as const),
      exercise: lastMessage.exercise ?? null,
      expectedType,
      degradedReason: lastMessage.exercise || !expectedType ? undefined : 'resume_missing_exercise',
    };
    const projection = deriveInteractionFromAssistantTurn({
      inputMode,
      awaitUserReply: lastMessage.awaitUserReply === true,
      exerciseState,
    });
    return {
      interactionSurface: projection.interactionSurface,
      inputMode,
      waitingForUser: projection.waitingForUser,
      canContinue: projection.canContinue,
      exerciseState,
      requestAi: false,
    };
  }

  return {
    interactionSurface: 'idle' as const,
    inputMode: 'none' as const,
    waitingForUser: false,
    canContinue: false,
    exerciseState: {
      status: 'idle' as const,
      exercise: null,
      expectedType: null,
    },
    requestAi: true,
  };
}

function buildRequirementSessionSummary(messages: LearnPathState['messages']) {
  const assistantMessages = messages
    .filter((message) => message.role === 'assistant')
    .map((message) => message.content.trim())
    .filter(Boolean);
  if (assistantMessages.length === 0) return undefined;
  return assistantMessages.slice(-2).join('\n\n').slice(0, 1200);
}
