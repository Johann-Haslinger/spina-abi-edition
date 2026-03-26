import type { Chapter, Requirement } from '../../../../domain/models';
import type { RequirementRailHistoryMessage } from './ai/requirementRailAiClient';
import type { RailState } from './rail/standardRequirementRail';

export type LearnPathGroup = {
  chapter: Chapter;
  requirements: Requirement[];
};

export type LearnPathMessage = {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  chapterId: string;
  requirementId: string;
  currentState?: RailState;
  allowedNextStates?: RailState[];
  suggestedNextState?: RailState;
  appliedNextState?: RailState;
  stateChanged?: boolean;
  awaitUserReply?: boolean;
};

export type LearnPathState = {
  started: boolean;
  loading: boolean;
  error: string | null;
  pathCompleted: boolean;
  waitingForUser: boolean;
  canContinue: boolean;
  currentChapterIndex: number;
  currentRequirementIndex: number;
  currentState: RailState;
  messages: LearnPathMessage[];
  requestNonce: number;
};

export type LearnPathAction =
  | {
      type: 'START_PATH';
      chapterName: string;
      chapterId: string;
      requirementName: string;
      requirementId: string;
    }
  | {
      type: 'SET_LOADING';
      loading: boolean;
    }
  | {
      type: 'SET_ERROR';
      error: string | null;
    }
  | {
      type: 'APPEND_USER_MESSAGE';
      chapterId: string;
      requirementId: string;
      content: string;
    }
  | {
      type: 'APPEND_ASSISTANT_MESSAGE';
      message: LearnPathMessage;
    }
  | {
      type: 'SET_INTERACTION_STATE';
      railState: RailState;
      waitingForUser: boolean;
      canContinue: boolean;
    }
  | {
      type: 'REQUEST_AI';
    }
  | {
      type: 'START_NEXT_REQUIREMENT';
      chapterIndex: number;
      requirementIndex: number;
      chapterName: string;
      chapterId: string;
      requirementName: string;
      requirementId: string;
    }
  | {
      type: 'COMPLETE_PATH';
    };

export const initialLearnPathState: LearnPathState = {
  started: false,
  loading: false,
  error: null,
  pathCompleted: false,
  waitingForUser: false,
  canContinue: false,
  currentChapterIndex: 0,
  currentRequirementIndex: 0,
  currentState: 'intro',
  messages: [],
  requestNonce: 0,
};

export type LearnPathViewModel = {
  groupedRequirements: LearnPathGroup[];
  totalRequirements: number;
  currentGroup?: LearnPathGroup;
  currentChapter?: Chapter;
  currentRequirement?: Requirement;
  currentRequirementPosition: number;
  currentAllowedNextStates: RailState[];
};

export type RequirementHistoryBuilder = (
  messages: LearnPathMessage[],
  chapterId: string,
  requirementId: string,
) => RequirementRailHistoryMessage[];
