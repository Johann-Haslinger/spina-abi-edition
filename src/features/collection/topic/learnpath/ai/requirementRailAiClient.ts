import { getSupabaseClient } from '../../../../../lib/supabaseClient';
import type { LearnPathMode } from '../../../../../domain/models';
import type {
  LearnPathExercise,
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
  plan?: RequirementPlan | null;
  currentStepId?: string | null;
};

export type RequirementPlanAiResponse = {
  plan?: RequirementPlan;
  currentStepId?: string;
  message: string;
  messageKind: LearnPathMessageKind;
  expectsInput: LearnPathInputMode;
  exercise?: LearnPathExercise;
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
      plan: input.plan,
      currentStepId: input.currentStepId,
    },
  });
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
  const exercise = parseExercise(p.exercise);
  const masteryDelta =
    typeof p.mastery_delta === 'number' && Number.isFinite(p.mastery_delta)
      ? p.mastery_delta
      : undefined;
  const awaitUserReply = p.await_user_reply === true;
  const completeRequirement = p.complete_requirement === true;

  return {
    plan: parsedPlan,
    currentStepId,
    message,
    messageKind,
    expectsInput,
    exercise,
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
    case 'single_choice':
    case 'matching':
    case 'free_text':
      return value;
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
    exerciseType: isExerciseType(row.exerciseType) ? row.exerciseType : undefined,
    description: typeof row.description === 'string' ? row.description : undefined,
  };
}

function parseExercise(value: unknown): LearnPathExercise | undefined {
  const row = (value ?? null) as Record<string, unknown> | null;
  if (!row || typeof row.type !== 'string' || typeof row.prompt !== 'string') return undefined;

  if (row.type === 'single_choice' && Array.isArray(row.options)) {
    const options = row.options
      .map((option) => {
        const item = (option ?? null) as { id?: unknown; text?: unknown } | null;
        if (!item || typeof item.id !== 'string' || typeof item.text !== 'string') return null;
        return { id: item.id, text: item.text };
      })
      .filter((option): option is { id: string; text: string } => option != null);
    if (options.length > 1) return { type: 'single_choice', prompt: row.prompt, options };
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

function isStepType(value: unknown): value is RequirementPlan['steps'][number]['type'] {
  return (
    value === 'explain' ||
    value === 'check' ||
    value === 'exercise' ||
    value === 'review' ||
    value === 'complete'
  );
}

function isExerciseType(value: unknown): value is NonNullable<RequirementPlan['steps'][number]['exerciseType']> {
  return value === 'single_choice' || value === 'matching' || value === 'free_text';
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
