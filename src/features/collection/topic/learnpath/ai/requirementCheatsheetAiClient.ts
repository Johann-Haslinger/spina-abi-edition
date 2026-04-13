import { getSupabaseClient } from '../../../../../lib/supabaseClient';
import type { RequirementPlanHistoryMessage } from '../types';

export type RequirementCheatsheetAiRequest = {
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

export type RequirementCheatsheetDraft = {
  title?: string;
  content: string;
};

export async function generateRequirementCheatsheet(
  input: RequirementCheatsheetAiRequest,
): Promise<RequirementCheatsheetDraft> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke('requirement-cheatsheet', {
    body: {
      requirementGoal: input.requirementGoal,
      history: input.history,
      chapterContext: input.chapterContext,
      requirementContext: input.requirementContext,
    },
  });

  const payload = await unwrapFunctionResponse(data, error);
  if (!payload || typeof payload !== 'object') {
    throw new Error('Ungueltige Merkblatt-Antwort');
  }

  const title = typeof (payload as { title?: unknown }).title === 'string'
    ? (payload as { title: string }).title.trim()
    : undefined;
  const content = typeof (payload as { content?: unknown }).content === 'string'
    ? (payload as { content: string }).content.trim()
    : '';

  if (!content) {
    throw new Error('Es konnte kein gueltiges Merkblatt erzeugt werden');
  }

  return { title, content };
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
