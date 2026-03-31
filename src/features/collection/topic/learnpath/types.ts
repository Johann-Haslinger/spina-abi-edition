import type { Chapter, LearnPathMode, LearnPathProgress, Requirement } from '../../../../domain/models';

export type LearnPathGroup = {
  chapter: Chapter;
  requirements: Requirement[];
};

export type LearnPathStepType = 'explain' | 'check' | 'exercise' | 'review' | 'complete';

export type LearnPathExerciseType = 'quiz' | 'matching' | 'free_text';

export type LearnPathInputMode =
  | 'none'
  | 'text'
  | 'quiz'
  | 'matching'
  | 'free_text';

export type LearnPathInteractionSurface = 'idle' | 'chat' | 'exercise' | 'continue';

export type LearnPathExerciseStateStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'error';

export type LearnPathExerciseState = {
  status: LearnPathExerciseStateStatus;
  exercise: LearnPathExercise | null;
  expectedType: LearnPathExerciseType | null;
  degradedReason?: string;
};

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
  feedback?: string;
};

export type LearnPathQuizQuestion = {
  id: string;
  prompt: string;
  options: LearnPathOption[];
  correctOptionId: string;
  explanation?: string;
};

export type LearnPathMatchingItem = {
  id: string;
  text: string;
};

export type LearnPathMatchingPair = {
  leftId: string;
  rightId: string;
};

export type QuizExercise = {
  type: 'quiz';
  prompt: string;
  questions: LearnPathQuizQuestion[];
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
  | QuizExercise
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
      kind: 'quiz';
      answers: {
        questionId: string;
        selectedOptionId: string;
      }[];
      summary?: {
        score: number;
        total: number;
        incorrectQuestionIds: string[];
      };
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

export type LearnPathPanelView = 'current_requirement' | 'all_requirements';

export type LearnPathCompletionPrompt = 'next_action' | 'after_flashcards';

export type LearnPathMessage = {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  chapterId: string;
  requirementId: string;
  stepId?: string;
  stepType?: LearnPathStepType;
  messageKind?: LearnPathMessageKind;
  interactionSurface?: LearnPathInteractionSurface;
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
  panelOpen: boolean;
  panelView: LearnPathPanelView;
  currentChapterIndex: number;
  currentRequirementIndex: number;
  activePlan: RequirementPlan | null;
  activeStepId: string | null;
  interactionSurface: LearnPathInteractionSurface;
  inputMode: LearnPathInputMode;
  exerciseState: LearnPathExerciseState;
  completionPrompt: LearnPathCompletionPrompt | null;
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
      interactionSurface?: LearnPathInteractionSurface;
      waitingForUser?: boolean;
      canContinue?: boolean;
      exerciseState?: LearnPathExerciseState;
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
      type: 'SET_PANEL_OPEN';
      open: boolean;
    }
  | {
      type: 'SET_PANEL_VIEW';
      view: LearnPathPanelView;
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
      type: 'APPLY_ASSISTANT_TURN';
      message: LearnPathMessage;
      stepId: string | null;
      interactionSurface: LearnPathInteractionSurface;
      inputMode: LearnPathInputMode;
      waitingForUser: boolean;
      canContinue: boolean;
      exerciseState: LearnPathExerciseState;
    }
  | {
      type: 'SET_REQUIREMENT_PLAN';
      plan: RequirementPlan;
      stepId: string | null;
    }
  | {
      type: 'REQUEST_AI';
    }
  | {
      type: 'SHOW_COMPLETION_PROMPT';
      prompt: LearnPathCompletionPrompt;
    }
  | {
      type: 'CLEAR_COMPLETION_PROMPT';
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
  panelOpen: false,
  panelView: 'current_requirement',
  currentChapterIndex: 0,
  currentRequirementIndex: 0,
  activePlan: null,
  activeStepId: null,
  interactionSurface: 'idle',
  inputMode: 'none',
  exerciseState: {
    status: 'idle',
    exercise: null,
    expectedType: null,
  },
  completionPrompt: null,
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
