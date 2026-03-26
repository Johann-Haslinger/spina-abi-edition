import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Chapter, Requirement } from '../../../../domain/models';
import { newId } from '../../../../lib/id';
import { requirementRepo } from '../../../../repositories';
import { useCurriculumStore } from '../../../../stores/curriculumStore';
import { useNotificationsStore } from '../../../../stores/notificationsStore';
import { requestRequirementRailStep } from './ai/requirementRailAiClient';
import { reduceLearnPathState } from './learnPathReducer';
import {
  buildGroupedRequirements,
  buildRequirementGoal,
  buildRequirementHistory,
  clampMastery,
  clampMasteryDelta,
  formatMasteryDelta,
  getCurrentRequirementPosition,
  getNextRequirementPosition,
} from './learnPathUtils';
import { getAllowedNextRailStates, isUserInputRailState } from './rail/standardRequirementRail';
import {
  initialLearnPathState,
  type LearnPathAction,
  type LearnPathGroup,
  type LearnPathState,
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
  const [state, dispatch] = useReducer(
    (currentState: LearnPathState, action: LearnPathAction) =>
      reduceLearnPathState(currentState, action),
    initialLearnPathState,
  );
  const stateRef = useRef(state);
  const groupedRequirementsRef = useRef<LearnPathGroup[]>([]);
  const lastTopicIdRef = useRef<string | null>(null);
  const handledRequestNonceRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (lastTopicIdRef.current === props.topicId) return;
    lastTopicIdRef.current = props.topicId;
    handledRequestNonceRef.current = 0;

    const store = useCurriculumStore.getState();
    const alreadyLoaded = (store.chaptersByTopic[props.topicId]?.length ?? 0) > 0;
    const isLoading = store.loadingByTopic[props.topicId] ?? false;
    if (alreadyLoaded || isLoading) return;

    void refreshTopicCurriculum(props.topicId);
  }, [props.topicId, refreshTopicCurriculum]);

  const groupedRequirements = useMemo(
    () => buildGroupedRequirements(chapters, requirements),
    [chapters, requirements],
  );

  useEffect(() => {
    groupedRequirementsRef.current = groupedRequirements;
  }, [groupedRequirements]);

  const totalRequirements = useMemo(
    () => groupedRequirements.reduce((sum, group) => sum + group.requirements.length, 0),
    [groupedRequirements],
  );

  const currentGroup = groupedRequirements[state.currentChapterIndex];
  const currentRequirement = currentGroup?.requirements[state.currentRequirementIndex];
  const currentChapter = currentGroup?.chapter;
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
  const currentAllowedNextStates = useMemo(
    () => getAllowedNextRailStates(state.currentState),
    [state.currentState],
  );
  const currentRequirementGoal = currentRequirement ? buildRequirementGoal(currentRequirement) : '';

  useEffect(() => {
    if (curriculumLoading || groupedRequirements.length === 0 || state.started) return;
    const firstGroup = groupedRequirements[0];
    const firstRequirement = firstGroup?.requirements[0];
    if (!firstGroup || !firstRequirement) return;

    dispatch({
      type: 'START_PATH',
      chapterName: firstGroup.chapter.name,
      chapterId: firstGroup.chapter.id,
      requirementName: firstRequirement.name,
      requirementId: firstRequirement.id,
    });
  }, [curriculumLoading, groupedRequirements, state.started]);

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
        if (!snapshot.started || snapshot.pathCompleted || !group || !requirement) return;

        const currentState = snapshot.currentState;
        const allowedNextStates = getAllowedNextRailStates(currentState);
        const history = buildRequirementHistory(snapshot.messages, group.chapter.id, requirement.id);
        const lastUserMessage = [...history]
          .reverse()
          .find((message) => message.role === 'user')?.content;
        const hasUserAnswer = Boolean(lastUserMessage?.trim());

        const response = await requestRequirementRailStep({
          requirementGoal: buildRequirementGoal(requirement),
          currentState,
          allowedNextStates,
          history,
          lastUserMessage,
          chapterContext: {
            subjectName: props.subjectName,
            topicName: props.topicName,
            chapterName: group.chapter.name,
            requirementName: requirement.name,
          },
        });

        const suggestedNextStateRaw =
          response.suggestedNextState &&
          allowedNextStates.includes(response.suggestedNextState)
            ? response.suggestedNextState
            : undefined;
        // Wenn die KI “wechselt” in exakt denselben State, werten wir das als keinen Wechsel.
        const suggestedNextState =
          suggestedNextStateRaw && suggestedNextStateRaw === currentState
            ? undefined
            : suggestedNextStateRaw;
        const appliedNextState = suggestedNextState ?? currentState;
        const awaitUserReply = response.awaitUserReply === true;

        dispatch({
          type: 'APPEND_ASSISTANT_MESSAGE',
          message: {
            id: newId(),
            role: 'assistant',
            content: response.message,
            chapterId: group.chapter.id,
            requirementId: requirement.id,
            currentState,
            allowedNextStates,
            suggestedNextState,
            appliedNextState,
            stateChanged: appliedNextState !== currentState,
            awaitUserReply,
          },
        });

        if (appliedNextState === 'requirement_complete') {
          const masteryDelta = clampMasteryDelta(response.masteryDelta ?? 0.12);
          await requirementRepo.update(requirement.id, {
            mastery: clampMastery(requirement.mastery + masteryDelta),
          });
          await refreshTopicCurriculum(props.topicId);
          pushNotification({
            tone: 'success',
            title: 'Requirement abgeschlossen',
            message: `${requirement.name}: ${formatMasteryDelta(masteryDelta)}`,
          });

          const nextPosition = getNextRequirementPosition(
            groups,
            snapshot.currentChapterIndex,
            snapshot.currentRequirementIndex,
          );
          if (!nextPosition) {
            dispatch({ type: 'COMPLETE_PATH' });
            return;
          }

          const nextGroup = groups[nextPosition.chapterIndex];
          const nextRequirement = nextGroup?.requirements[nextPosition.requirementIndex];
          if (!nextGroup || !nextRequirement) {
            dispatch({ type: 'COMPLETE_PATH' });
            return;
          }

          dispatch({
            type: 'START_NEXT_REQUIREMENT',
            chapterIndex: nextPosition.chapterIndex,
            requirementIndex: nextPosition.requirementIndex,
            chapterName: nextGroup.chapter.name,
            chapterId: nextGroup.chapter.id,
            requirementName: nextRequirement.name,
            requirementId: nextRequirement.id,
          });
          return;
        }

        // Hard guardrail: intro darf nicht stehen bleiben.
        // Falls die KI keinen Wechsel liefert, erzwingen wir intro -> explain_core.
        if (currentState === 'intro' && appliedNextState === 'intro') {
          dispatch({
            type: 'SET_INTERACTION_STATE',
            railState: 'explain_core',
            waitingForUser: false,
            canContinue: false,
          });
          dispatch({ type: 'REQUEST_AI' });
          return;
        }

        // Die KI kann auch ausserhalb klassischer check_* States bewusst auf eine Nutzerantwort warten,
        // z.B. fuer Rueckfragen, Vertiefungswunsch oder kurzes Verstaendnis-Check-in.
        if (awaitUserReply) {
          dispatch({
            type: 'SET_INTERACTION_STATE',
            railState: appliedNextState,
            waitingForUser: true,
            canContinue: false,
          });
          return;
        }

        // UserInput-States (check_short/check_final) sind im MVP antwortpflichtig.
        if (isUserInputRailState(currentState)) {
          if (!hasUserAnswer) {
            dispatch({
              type: 'SET_INTERACTION_STATE',
              railState: currentState,
              waitingForUser: true,
              canContinue: false,
            });
            return;
          }

          if (appliedNextState !== currentState) {
            dispatch({
              type: 'SET_INTERACTION_STATE',
              railState: appliedNextState,
              waitingForUser: false,
              canContinue: false,
            });
            dispatch({ type: 'REQUEST_AI' });
            return;
          }

          dispatch({
            type: 'SET_INTERACTION_STATE',
            railState: currentState,
            waitingForUser: true,
            canContinue: false,
          });
          return;
        }

        if (appliedNextState !== currentState) {
          dispatch({
            type: 'SET_INTERACTION_STATE',
            railState: appliedNextState,
            waitingForUser: false,
            canContinue: false,
          });
          dispatch({ type: 'REQUEST_AI' });
          return;
        }

        dispatch({
          type: 'SET_INTERACTION_STATE',
          railState: currentState,
          waitingForUser: false,
          canContinue: true,
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
    [props.subjectName, props.topicId, props.topicName, pushNotification, refreshTopicCurriculum],
  );

  useEffect(() => {
    if (!state.started || state.requestNonce === 0) return;
    if (state.loading) return;
    if (handledRequestNonceRef.current === state.requestNonce) return;
    void runAiRail(state.requestNonce);
  }, [runAiRail, state.loading, state.requestNonce, state.started]);

  const handleSend = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed || state.loading || !state.waitingForUser || !currentChapter || !currentRequirement) return;

    dispatch({
      type: 'APPEND_USER_MESSAGE',
      chapterId: currentChapter.id,
      requirementId: currentRequirement.id,
      content: trimmed,
    });
    dispatch({ type: 'REQUEST_AI' });
    setDraft('');
  }, [currentChapter, currentRequirement, draft, state.loading, state.waitingForUser]);

  const handleContinue = useCallback(() => {
    if (state.loading || !state.canContinue) return;
    dispatch({ type: 'REQUEST_AI' });
  }, [state.canContinue, state.loading]);

  const handleRestart = useCallback(() => {
    const firstGroup = groupedRequirements[0];
    const firstRequirement = firstGroup?.requirements[0];
    if (!firstGroup || !firstRequirement) return;
    handledRequestNonceRef.current = 0;
    setDraft('');
    dispatch({
      type: 'START_PATH',
      chapterName: firstGroup.chapter.name,
      chapterId: firstGroup.chapter.id,
      requirementName: firstRequirement.name,
      requirementId: firstRequirement.id,
    });
  }, [groupedRequirements]);

  return {
    curriculumLoading,
    curriculumError,
    draft,
    setDraft,
    state,
    groupedRequirements,
    totalRequirements,
    currentGroup,
    currentChapter,
    currentRequirement,
    currentRequirementPosition,
    currentAllowedNextStates,
    currentRequirementGoal,
    handleSend,
    handleContinue,
    handleRestart,
  };
}
