import { getSupabaseClient } from '../../../../../lib/supabaseClient';
import { isRailState, type RailState } from '../rail/standardRequirementRail';

export type RequirementRailHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type RequirementRailAiRequest = {
  requirementGoal: string;
  currentState: RailState;
  allowedNextStates: RailState[];
  history: RequirementRailHistoryMessage[];
  lastUserMessage?: string;
  chapterContext?: {
    subjectName?: string;
    topicName?: string;
    chapterName: string;
    requirementName: string;
  };
};

export type RequirementRailAiResponse = {
  message: string;
  suggestedNextState?: RailState;
  masteryDelta?: number;
  awaitUserReply?: boolean;
};

export async function requestRequirementRailStep(
  input: RequirementRailAiRequest,
): Promise<RequirementRailAiResponse> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke('requirement-rail-ai', {
    body: {
      requirementGoal: input.requirementGoal,
      currentState: input.currentState,
      allowedNextStates: input.allowedNextStates,
      history: input.history,
      lastUserMessage: input.lastUserMessage,
      chapterContext: input.chapterContext,
    },
  });
  const payload = await unwrapFunctionResponse(data, error);
  if (!payload || typeof payload !== 'object') {
    throw new Error('Ungueltige Wissenspfad-Antwort');
  }

  const p = payload as Record<string, unknown>;
  const message = typeof p.message === 'string' ? p.message.trim() : '';
  if (!message) throw new Error('Wissenspfad-Antwort enthaelt keine Nachricht');

  const suggestedNextState = isRailState(p.suggested_next_state)
    ? p.suggested_next_state
    : undefined;
  const masteryDelta =
    typeof p.mastery_delta === 'number' && Number.isFinite(p.mastery_delta)
      ? p.mastery_delta
      : undefined;
  const awaitUserReply = p.await_user_reply === true;

  return {
    message,
    suggestedNextState,
    masteryDelta,
    awaitUserReply,
  };
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
