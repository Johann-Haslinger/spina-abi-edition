import type { Chapter, LearnPathMode, LearnPathProgress, Requirement } from '../../../../domain/models';

export type LearnPathGroup = {
  chapter: Chapter;
  requirements: Requirement[];
};

export type LearnPathStepType = 'explain' | 'check' | 'exercise' | 'review' | 'complete';

export type LearnPathExerciseType = 'single_choice' | 'matching' | 'free_text';

export type LearnPathInputMode =
  | 'none'
  | 'text'
  | 'single_choice'
  | 'matching'
  | 'free_text';

export type LearnPathMessageKind =
  | 'plan'
  | 'explanation'
  | 'question'
  | 'exercise'
  | 'feedback'
  | 'completion';

export type LearnPathOption = {
  id: string;
  text: string;
};

export type LearnPathMatchingItem = {
  id: string;
  text: string;
};

export type LearnPathMatchingPair = {
  leftId: string;
  rightId: string;
};

export type SingleChoiceExercise = {
  type: 'single_choice';
  prompt: string;
  options: LearnPathOption[];
};

export type MatchingExercise = {
  type: 'matching';
  prompt: string;
  leftItems: LearnPathMatchingItem[];
  rightItems: LearnPathMatchingItem[];
};

export type FreeTextExercise = {
  type: 'free_text';
  prompt: string;
  placeholder?: string;
};

export type LearnPathExercise =
  | SingleChoiceExercise
  | MatchingExercise
  | FreeTextExercise;

export type RequirementPlanStep = {
  id: string;
  title: string;
  type: LearnPathStepType;
  exerciseType?: LearnPathExerciseType;
  description?: string;
};

export type RequirementPlan = {
  id: string;
  steps: RequirementPlanStep[];
};

export type LearnPathTurnResponse =
  | {
      kind: 'text';
      text: string;
    }
  | {
      kind: 'single_choice';
      selectedOptionId: string;
    }
  | {
      kind: 'matching';
      pairs: LearnPathMatchingPair[];
    }
  | {
      kind: 'free_text';
      text: string;
    };

export type RequirementPlanHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
  stepId?: string;
  stepType?: LearnPathStepType;
  messageKind?: LearnPathMessageKind;
  response?: LearnPathTurnResponse;
};

export type LearnPathRequirementStatus = 'open' | 'in_progress' | 'completed' | 'reviewing';

export type LearnPathRequirementOverviewItem = {
  chapter: Chapter;
  requirement: Requirement;
  status: LearnPathRequirementStatus;
  learnProgress?: LearnPathProgress;
  reviewProgress?: LearnPathProgress;
};

export type LearnPathMessage = {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  chapterId: string;
  requirementId: string;
  stepId?: string;
  stepType?: LearnPathStepType;
  messageKind?: LearnPathMessageKind;
  inputMode?: LearnPathInputMode;
  awaitUserReply?: boolean;
  exercise?: LearnPathExercise;
  response?: LearnPathTurnResponse;
};

export type LearnPathState = {
  started: boolean;
  loading: boolean;
  progressLoading: boolean;
  error: string | null;
  pathCompleted: boolean;
  waitingForUser: boolean;
  canContinue: boolean;
  mode: LearnPathMode | null;
  activeProgressId: string | null;
  currentChapterIndex: number;
  currentRequirementIndex: number;
  activePlan: RequirementPlan | null;
  activeStepId: string | null;
  inputMode: LearnPathInputMode;
  pendingExercise: LearnPathExercise | null;
  messages: LearnPathMessage[];
  requestNonce: number;
};

export type LearnPathAction =
  | {
      type: 'START_PATH';
      chapterIndex: number;
      requirementIndex: number;
      chapterName: string;
      chapterId: string;
      requirementName: string;
      requirementId: string;
      mode: LearnPathMode;
      progressId: string;
      plan?: RequirementPlan | null;
      stepId?: string | null;
      messages?: LearnPathMessage[];
      inputMode?: LearnPathInputMode;
      waitingForUser?: boolean;
      canContinue?: boolean;
      exercise?: LearnPathExercise | null;
      requestAi?: boolean;
    }
  | {
      type: 'SET_LOADING';
      loading: boolean;
    }
  | {
      type: 'SET_PROGRESS_LOADING';
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
      stepId?: string | null;
      stepType?: LearnPathStepType;
      response?: LearnPathTurnResponse;
    }
  | {
      type: 'APPEND_ASSISTANT_MESSAGE';
      message: LearnPathMessage;
    }
  | {
      type: 'SET_REQUIREMENT_PLAN';
      plan: RequirementPlan;
      stepId: string | null;
    }
  | {
      type: 'SET_INTERACTION_STATE';
      stepId: string | null;
      inputMode: LearnPathInputMode;
      waitingForUser: boolean;
      canContinue: boolean;
      exercise: LearnPathExercise | null;
    }
  | {
      type: 'REQUEST_AI';
    }
  | {
      type: 'RESET_TO_OVERVIEW';
    }
  | {
      type: 'START_NEXT_REQUIREMENT';
      chapterIndex: number;
      requirementIndex: number;
      chapterName: string;
      chapterId: string;
      requirementName: string;
      requirementId: string;
      progressId: string;
      mode: LearnPathMode;
    }
  | {
      type: 'COMPLETE_PATH';
    };

export const initialLearnPathState: LearnPathState = {
  started: false,
  loading: false,
  progressLoading: false,
  error: null,
  pathCompleted: false,
  waitingForUser: false,
  canContinue: false,
  mode: null,
  activeProgressId: null,
  currentChapterIndex: 0,
  currentRequirementIndex: 0,
  activePlan: null,
  activeStepId: null,
  inputMode: 'none',
  pendingExercise: null,
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
  activePlan: RequirementPlan | null;
  activeStep?: RequirementPlanStep;
};

export type RequirementHistoryBuilder = (
  messages: LearnPathMessage[],
  chapterId: string,
  requirementId: string,
) => RequirementPlanHistoryMessage[];
