import { newId } from '../../../../lib/id';
import type { LearnPathAction, LearnPathState } from './types';
import { initialLearnPathState } from './types';

export function reduceLearnPathState(
  state: LearnPathState,
  action: LearnPathAction,
): LearnPathState {
  if (action.type === 'START_PATH') {
    return {
      ...initialLearnPathState,
      started: true,
      mode: action.mode,
      activeProgressId: action.progressId,
      panelOpen: false,
      panelView: 'current_requirement',
      currentChapterIndex: action.chapterIndex,
      currentRequirementIndex: action.requirementIndex,
      activePlan: action.plan ?? null,
      activeStepId: action.stepId ?? null,
      interactionSurface: action.interactionSurface ?? 'idle',
      inputMode: action.inputMode ?? 'none',
      waitingForUser: action.waitingForUser ?? false,
      canContinue: action.canContinue ?? false,
      exerciseState:
        action.exerciseState ??
        initialLearnPathState.exerciseState,
      messages:
        action.messages && action.messages.length > 0
          ? action.messages
          : [
              {
                id: newId(),
                role: 'system',
                content: `Kapitel gestartet: ${action.chapterName} · Requirement: ${action.requirementName}`,
                chapterId: action.chapterId,
                requirementId: action.requirementId,
              },
            ],
      requestNonce: action.requestAi === false ? state.requestNonce : state.requestNonce + 1,
    };
  }

  if (action.type === 'SET_LOADING') {
    return {
      ...state,
      loading: action.loading,
    };
  }

  if (action.type === 'SET_PROGRESS_LOADING') {
    return {
      ...state,
      progressLoading: action.loading,
    };
  }

  if (action.type === 'SET_PANEL_OPEN') {
    return {
      ...state,
      panelOpen: action.open,
    };
  }

  if (action.type === 'SET_PANEL_VIEW') {
    return {
      ...state,
      panelView: action.view,
    };
  }

  if (action.type === 'SET_ERROR') {
    return {
      ...state,
      error: action.error,
    };
  }

  if (action.type === 'APPEND_USER_MESSAGE') {
    return {
      ...state,
      messages: [
        ...state.messages,
        {
          id: newId(),
          role: 'user',
          content: action.content,
          chapterId: action.chapterId,
          requirementId: action.requirementId,
          stepId: action.stepId ?? undefined,
          stepType: action.stepType,
          response: action.response,
        },
      ],
      waitingForUser: false,
      canContinue: false,
      interactionSurface: 'idle',
      inputMode: 'none',
      exerciseState: initialLearnPathState.exerciseState,
      error: null,
    };
  }

  if (action.type === 'APPLY_ASSISTANT_TURN') {
    return {
      ...state,
      messages: [...state.messages, action.message],
      activeStepId: action.stepId,
      interactionSurface: action.interactionSurface,
      inputMode: action.inputMode,
      waitingForUser: action.waitingForUser,
      canContinue: action.canContinue,
      exerciseState: action.exerciseState,
      error: null,
    };
  }

  if (action.type === 'SET_REQUIREMENT_PLAN') {
    return {
      ...state,
      activePlan: action.plan,
      activeStepId: action.stepId,
      error: null,
    };
  }

  if (action.type === 'REQUEST_AI') {
    return {
      ...state,
      waitingForUser: false,
      canContinue: false,
      interactionSurface: 'idle',
      inputMode: 'none',
      exerciseState: {
        status: 'loading',
        exercise: null,
        expectedType: null,
      },
      error: null,
      requestNonce: state.requestNonce + 1,
    };
  }

  if (action.type === 'RESET_TO_OVERVIEW') {
    return {
      ...initialLearnPathState,
      progressLoading: state.progressLoading,
      requestNonce: state.requestNonce,
    };
  }

  if (action.type === 'START_NEXT_REQUIREMENT') {
    return {
      ...state,
      mode: action.mode,
      activeProgressId: action.progressId,
      currentChapterIndex: action.chapterIndex,
      currentRequirementIndex: action.requirementIndex,
      waitingForUser: false,
      canContinue: false,
      interactionSurface: 'idle',
      activePlan: null,
      activeStepId: null,
      inputMode: 'none',
      exerciseState: initialLearnPathState.exerciseState,
      error: null,
      messages: [
        ...state.messages,
        {
          id: newId(),
          role: 'system',
          content: `Naechstes Requirement: ${action.chapterName} · ${action.requirementName}`,
          chapterId: action.chapterId,
          requirementId: action.requirementId,
        },
      ],
      requestNonce: state.requestNonce + 1,
    };
  }

  if (action.type === 'COMPLETE_PATH') {
    return {
      ...state,
      pathCompleted: true,
      waitingForUser: false,
      canContinue: false,
      interactionSurface: 'idle',
      messages: [
        ...state.messages,
        {
          id: newId(),
          role: 'system',
          content: 'Kapitelpfad abgeschlossen. Alle Requirements wurden linear bearbeitet.',
          chapterId: state.messages[state.messages.length - 1]?.chapterId ?? '',
          requirementId: state.messages[state.messages.length - 1]?.requirementId ?? '',
        },
      ],
    };
  }

  return state;
}
