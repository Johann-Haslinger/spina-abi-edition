import type { LearnPathMode } from '../../../../../domain/models';
import { getSupabaseClient } from '../../../../../lib/supabaseClient';
import type {
  LearnPathExercise,
  LearnPathExerciseState,
  LearnPathExerciseType,
  LearnPathInputMode,
  LearnPathMessageKind,
  RequirementPlan,
  RequirementPlanHistoryMessage,
} from '../types';

export type RequirementPlanAiRequest = {
  mode: 'plan' | 'turn';
  learningMode: LearnPathMode;
  requirementGoal: string;
  history: RequirementPlanHistoryMessage[];
  chapterContext?: {
    subjectName?: string;
    topicName?: string;
    chapterName: string;
    requirementName: string;
  };
  requirementContext?: {
    materialContext?: string;
  };
  plan?: RequirementPlan | null;
  currentStepId?: string | null;
};

export type RequirementPlanAiResponse = {
  reqId?: string;
  plan?: RequirementPlan;
  currentStepId?: string;
  message: string;
  messageKind: LearnPathMessageKind;
  expectsInput: LearnPathInputMode;
  exerciseState: LearnPathExerciseState;
  awaitUserReply: boolean;
  completeRequirement: boolean;
  masteryDelta?: number;
};

export async function requestRequirementPlanTurn(
  input: RequirementPlanAiRequest,
): Promise<RequirementPlanAiResponse> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke('requirement-rail-ai', {
    body: {
      mode: input.mode,
      learningMode: input.learningMode,
      requirementGoal: input.requirementGoal,
      history: input.history,
      chapterContext: input.chapterContext,
      requirementContext: input.requirementContext,
      plan: input.plan,
      currentStepId: input.currentStepId,
    },
  });
  console.log('data', data);
  const payload = await unwrapFunctionResponse(data, error);
  if (!payload || typeof payload !== 'object') {
    throw new Error('Ungueltige Wissenspfad-Antwort');
  }

  const p = payload as Record<string, unknown>;
  const message = typeof p.message === 'string' ? p.message.trim() : '';
  if (!message) throw new Error('Wissenspfad-Antwort enthaelt keine Nachricht');

  const parsedPlan = parseRequirementPlan(p.plan);
  if (input.mode === 'plan' && !parsedPlan) {
    throw new Error('Wissenspfad-Antwort enthaelt keinen gueltigen Fahrplan');
  }
  const currentStepId = typeof p.current_step_id === 'string' ? p.current_step_id : undefined;
  const messageKind = parseMessageKind(p.message_kind);
  const expectsInput = parseInputMode(p.expects_input);
  const expectedExerciseType = parseExpectedExerciseType(p.expected_exercise_type);
  const exercise = parseExercise(p.exercise);
  const exerciseState = parseExerciseState(
    p.exercise_status,
    exercise,
    expectedExerciseType,
    p.degraded_reason,
  );
  const masteryDelta =
    typeof p.mastery_delta === 'number' && Number.isFinite(p.mastery_delta)
      ? p.mastery_delta
      : undefined;
  const awaitUserReply = p.await_user_reply === true;
  const completeRequirement = p.complete_requirement === true;

  return {
    reqId: typeof p.req_id === 'string' ? p.req_id : undefined,
    plan: parsedPlan,
    currentStepId,
    message,
    messageKind,
    expectsInput,
    exerciseState,
    awaitUserReply,
    completeRequirement,
    masteryDelta,
  };
}

function parseMessageKind(value: unknown): LearnPathMessageKind {
  switch (value) {
    case 'plan':
    case 'explanation':
    case 'question':
    case 'exercise':
    case 'feedback':
    case 'completion':
      return value;
    default:
      return 'explanation';
  }
}

function parseInputMode(value: unknown): LearnPathInputMode {
  switch (value) {
    case 'none':
    case 'text':
    case 'quiz':
    case 'matching':
    case 'free_text':
      return value;
    case 'single_choice':
      return 'quiz';
    default:
      return 'none';
  }
}

function parseRequirementPlan(value: unknown): RequirementPlan | undefined {
  const row = (value ?? null) as { id?: unknown; steps?: unknown } | null;
  if (!row || typeof row.id !== 'string' || !Array.isArray(row.steps) || row.steps.length === 0) {
    return undefined;
  }

  const steps = row.steps
    .map((step) => parseRequirementPlanStep(step))
    .filter((step): step is RequirementPlan['steps'][number] => step != null);
  if (steps.length === 0) return undefined;

  return { id: row.id, steps };
}

function parseRequirementPlanStep(value: unknown): RequirementPlan['steps'][number] | null {
  const row = (value ?? null) as {
    id?: unknown;
    title?: unknown;
    type?: unknown;
    exerciseType?: unknown;
    description?: unknown;
  } | null;
  if (!row || typeof row.id !== 'string' || typeof row.title !== 'string') return null;
  if (!isStepType(row.type)) return null;

  return {
    id: row.id,
    title: row.title,
    type: row.type,
    exerciseType:
      row.exerciseType === 'single_choice'
        ? 'quiz'
        : isExerciseType(row.exerciseType)
          ? row.exerciseType
          : undefined,
    description: typeof row.description === 'string' ? row.description : undefined,
  };
}

function parseExercise(value: unknown): LearnPathExercise | undefined {
  const row = (value ?? null) as Record<string, unknown> | null;
  if (!row || typeof row.type !== 'string' || typeof row.prompt !== 'string') return undefined;

  if (row.type === 'quiz' && Array.isArray(row.questions)) {
    const questions = row.questions
      .map((question) => {
        const item = (question ?? null) as {
          id?: unknown;
          prompt?: unknown;
          options?: unknown;
          correctOptionId?: unknown;
          explanation?: unknown;
        } | null;
        if (
          !item ||
          typeof item.id !== 'string' ||
          typeof item.prompt !== 'string' ||
          !Array.isArray(item.options) ||
          typeof item.correctOptionId !== 'string'
        ) {
          return null;
        }
        const options = item.options
          .map((option) => {
            const entry = (option ?? null) as { id?: unknown; text?: unknown; feedback?: unknown } | null;
            if (!entry || typeof entry.id !== 'string' || typeof entry.text !== 'string')
              return null;
            const feedback = typeof entry.feedback === 'string' ? entry.feedback : undefined;
            return feedback
              ? { id: entry.id, text: entry.text, feedback }
              : { id: entry.id, text: entry.text };
          })
          .filter((option): option is { id: string; text: string; feedback?: string } => option != null);
        const hasCorrectOption = options.some((option) => option.id === item.correctOptionId);
        return options.length > 1 && hasCorrectOption
          ? {
              id: item.id,
              prompt: item.prompt,
              options,
              correctOptionId: item.correctOptionId,
              ...(typeof item.explanation === 'string' ? { explanation: item.explanation } : {}),
            }
          : null;
      })
      .filter(
        (
          question,
        ): question is {
          id: string;
          prompt: string;
          options: { id: string; text: string; feedback?: string }[];
          correctOptionId: string;
          explanation?: string;
        } => question != null,
      );
    if (questions.length > 0) return { type: 'quiz', prompt: row.prompt, questions };
  }

  if (row.type === 'single_choice' && Array.isArray(row.options)) {
    const correctOptionId =
      typeof row.correctOptionId === 'string'
        ? row.correctOptionId
        : typeof row.correct_option_id === 'string'
          ? row.correct_option_id
          : undefined;
    const options = row.options
      .map((option) => {
        const item = (option ?? null) as { id?: unknown; text?: unknown; feedback?: unknown } | null;
        if (!item || typeof item.id !== 'string' || typeof item.text !== 'string') return null;
        const feedback = typeof item.feedback === 'string' ? item.feedback : undefined;
        return feedback ? { id: item.id, text: item.text, feedback } : { id: item.id, text: item.text };
      })
      .filter((option): option is { id: string; text: string; feedback?: string } => option != null);
    if (options.length > 1) {
      const safeCorrectOptionId =
        correctOptionId && options.some((option) => option.id === correctOptionId)
          ? correctOptionId
          : options[0]?.id;
      if (!safeCorrectOptionId) return undefined;
      return {
        type: 'quiz',
        prompt: row.prompt,
        questions: [{ id: 'q1', prompt: row.prompt, options, correctOptionId: safeCorrectOptionId }],
      };
    }
  }

  if (row.type === 'matching' && Array.isArray(row.leftItems) && Array.isArray(row.rightItems)) {
    const leftItems = row.leftItems
      .map((item) => {
        const entry = (item ?? null) as { id?: unknown; text?: unknown } | null;
        if (!entry || typeof entry.id !== 'string' || typeof entry.text !== 'string') return null;
        return { id: entry.id, text: entry.text };
      })
      .filter((item): item is { id: string; text: string } => item != null);
    const rightItems = row.rightItems
      .map((item) => {
        const entry = (item ?? null) as { id?: unknown; text?: unknown } | null;
        if (!entry || typeof entry.id !== 'string' || typeof entry.text !== 'string') return null;
        return { id: entry.id, text: entry.text };
      })
      .filter((item): item is { id: string; text: string } => item != null);
    if (leftItems.length > 1 && rightItems.length > 1) {
      return { type: 'matching', prompt: row.prompt, leftItems, rightItems };
    }
  }

  if (row.type === 'free_text') {
    return {
      type: 'free_text',
      prompt: row.prompt,
      placeholder: typeof row.placeholder === 'string' ? row.placeholder : undefined,
    };
  }

  return undefined;
}

function parseExpectedExerciseType(value: unknown): LearnPathExerciseType | null {
  if (value === 'single_choice') return 'quiz';
  return isExerciseType(value) ? value : null;
}

function parseExerciseState(
  statusValue: unknown,
  exercise: LearnPathExercise | undefined,
  expectedType: LearnPathExerciseType | null,
  degradedReason: unknown,
): LearnPathExerciseState {
  const status =
    statusValue === 'loading' ||
    statusValue === 'ready' ||
    statusValue === 'missing' ||
    statusValue === 'error'
      ? statusValue
      : exercise
        ? 'ready'
        : expectedType
          ? 'missing'
          : 'idle';
  return {
    status,
    exercise: exercise ?? null,
    expectedType,
    degradedReason: typeof degradedReason === 'string' ? degradedReason : undefined,
  };
}

function isStepType(value: unknown): value is RequirementPlan['steps'][number]['type'] {
  return (
    value === 'explain' ||
    value === 'check' ||
    value === 'exercise' ||
    value === 'review' ||
    value === 'complete'
  );
}

function isExerciseType(
  value: unknown,
): value is NonNullable<RequirementPlan['steps'][number]['exerciseType']> {
  return value === 'quiz' || value === 'matching' || value === 'free_text';
}

async function unwrapFunctionResponse(data: unknown, error: unknown) {
  if (!error) {
    const d = data as { error?: unknown } | null;
    if (typeof d?.error === 'string' && d.error) throw new Error(d.error);
    return data;
  }

  const fnError = error as { message?: string; context?: { response?: Response } } | null;
  const resp = fnError?.context?.response;
  if (resp) {
    try {
      const text = await resp.text();
      if (text) {
        try {
          const parsed = JSON.parse(text) as { error?: unknown };
          if (typeof parsed.error === 'string' && parsed.error) throw new Error(parsed.error);
        } catch {
          throw new Error(text);
        }
      }
    } catch (readError) {
      if (readError instanceof Error) throw readError;
    }
  }

  throw new Error(fnError?.message || 'Edge Function Fehler');
}
