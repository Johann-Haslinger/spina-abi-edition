import { getSupabaseClient } from '../../../../../lib/supabaseClient';
import type { RequirementPlanHistoryMessage } from '../types';

export type RequirementFlashcardAiRequest = {
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
};

export type RequirementFlashcardDraft = {
  front: string;
  back: string;
};

export async function generateRequirementFlashcards(
  input: RequirementFlashcardAiRequest,
): Promise<RequirementFlashcardDraft[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke('requirement-flashcards', {
    body: {
      requirementGoal: input.requirementGoal,
      history: input.history,
      chapterContext: input.chapterContext,
      requirementContext: input.requirementContext,
    },
  });

  const payload = await unwrapFunctionResponse(data, error);
  if (!payload || typeof payload !== 'object') {
    throw new Error('Ungueltige Karteikarten-Antwort');
  }

  const flashcards = Array.isArray((payload as { flashcards?: unknown }).flashcards)
    ? (payload as { flashcards: unknown[] }).flashcards
    : [];

  const parsed = flashcards
    .map((card) => {
      const row = (card ?? null) as { front?: unknown; back?: unknown } | null;
      const front = typeof row?.front === 'string' ? row.front.trim() : '';
      const back = typeof row?.back === 'string' ? row.back.trim() : '';
      return front && back ? { front, back } : null;
    })
    .filter((card): card is RequirementFlashcardDraft => card != null);

  if (parsed.length === 0) {
    throw new Error('Es konnten keine gueltigen Karteikarten erzeugt werden');
  }

  return parsed;
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
