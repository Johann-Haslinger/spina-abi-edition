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
      currentChapterIndex: 0,
      currentRequirementIndex: 0,
      currentState: 'intro',
      messages: [
        {
          id: newId(),
          role: 'system',
          content: `Kapitel gestartet: ${action.chapterName} · Requirement: ${action.requirementName}`,
          chapterId: action.chapterId,
          requirementId: action.requirementId,
        },
      ],
      requestNonce: state.requestNonce + 1,
    };
  }

  if (action.type === 'SET_LOADING') {
    return {
      ...state,
      loading: action.loading,
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
        },
      ],
      waitingForUser: false,
      canContinue: false,
      error: null,
    };
  }

  if (action.type === 'APPEND_ASSISTANT_MESSAGE') {
    return {
      ...state,
      messages: [...state.messages, action.message],
      error: null,
    };
  }

  if (action.type === 'SET_INTERACTION_STATE') {
    return {
      ...state,
      currentState: action.railState,
      waitingForUser: action.waitingForUser,
      canContinue: action.canContinue,
      error: null,
    };
  }

  if (action.type === 'REQUEST_AI') {
    return {
      ...state,
      waitingForUser: false,
      canContinue: false,
      error: null,
      requestNonce: state.requestNonce + 1,
    };
  }

  if (action.type === 'START_NEXT_REQUIREMENT') {
    return {
      ...state,
      currentChapterIndex: action.chapterIndex,
      currentRequirementIndex: action.requirementIndex,
      currentState: 'intro',
      waitingForUser: false,
      canContinue: false,
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
