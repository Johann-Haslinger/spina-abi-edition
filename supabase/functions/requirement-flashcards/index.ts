// @ts-expect-error Deno URL imports are resolved in the Supabase Edge runtime.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
};

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-auth',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ReqBody = {
  requirementGoal?: unknown;
  history?: unknown;
  chapterContext?: unknown;
  requirementContext?: unknown;
};

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

    const body = (await req.json()) as ReqBody;
    const requirementGoal =
      typeof body.requirementGoal === 'string' ? body.requirementGoal.trim() : '';
    if (!requirementGoal) return json(400, { error: 'requirementGoal fehlt' });

    const chapterContext = normalizeChapterContext(body.chapterContext);
    const requirementContext = normalizeRequirementContext(body.requirementContext);
    const history = normalizeHistory(body.history);
    const model = Deno.env.get('OPENAI_MODEL') || 'gpt-5.2';
    const apiKey = assertEnv('OPENAI_API_KEY');

    const prompt = buildPrompt({
      requirementGoal,
      chapterContext,
      requirementContext,
      history,
    });

    const openaiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_output_tokens: 1000,
        input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text().catch(() => '');
      return json(500, { error: errText || 'OpenAI Anfrage fehlgeschlagen' });
    }

    const payload = safeJsonParse(extractAssistantText(await openaiRes.json()));
    const flashcards = normalizeFlashcards(payload?.flashcards);
    if (flashcards.length === 0) {
      return json(500, { error: 'Die KI hat keine gueltigen Karteikarten geliefert' });
    }

    return json(200, { flashcards });
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : 'Karteikarten-Generierung fehlgeschlagen',
    });
  }
});

function buildPrompt(input: {
  requirementGoal: string;
  chapterContext: {
    subjectName?: string;
    topicName?: string;
    chapterName?: string;
    requirementName?: string;
  };
  requirementContext: {
    materialSnippets: string[];
  };
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
}) {
  const contextLines = [
    input.chapterContext.subjectName ? `Fach: ${input.chapterContext.subjectName}` : null,
    input.chapterContext.topicName ? `Thema: ${input.chapterContext.topicName}` : null,
    input.chapterContext.chapterName ? `Kapitel: ${input.chapterContext.chapterName}` : null,
    input.chapterContext.requirementName
      ? `Requirement: ${input.chapterContext.requirementName}`
      : null,
    `Lernziel: ${input.requirementGoal}`,
    input.requirementContext.materialSnippets.length > 0
      ? `Unterrichtsmaterial: ${input.requirementContext.materialSnippets.join(' | ')}`
      : null,
  ].filter(Boolean);

  const historyBlock =
    input.history.length > 0
      ? input.history
          .slice(-10)
          .map(
            (message) =>
              `${message.role === 'assistant' ? 'Tutor' : 'Lernende Person'}: ${message.content}`,
          )
          .join('\n\n')
      : 'Keine weitere Lernhistorie vorhanden.';

  return [
    'Erzeuge 4 bis 6 hochwertige Karteikarten fuer ein abgeschlossenes Requirement.',
    'Die Karten muessen knapp, fachlich korrekt und fuer aktives Erinnern geeignet sein.',
    'Wenn Unterrichtsmaterial angegeben ist, priorisiere dessen Begriffe und Inhalte.',
    'Nutze Vorderseite fuer die Frage oder den Begriff, Rueckseite fuer die praezise Antwort.',
    'Vermeide triviale Duplikate und formuliere die Rueckseiten konkret.',
    'Antworte ausschliesslich als JSON im Format {"flashcards":[{"front":"...","back":"..."}]}.',
    '',
    'Kontext:',
    ...contextLines,
    '',
    'Lernverlauf:',
    historyBlock,
  ].join('\n');
}

function normalizeChapterContext(value: unknown) {
  const row = (value ?? null) as {
    subjectName?: unknown;
    topicName?: unknown;
    chapterName?: unknown;
    requirementName?: unknown;
  } | null;
  return {
    subjectName: typeof row?.subjectName === 'string' ? row.subjectName.trim() : undefined,
    topicName: typeof row?.topicName === 'string' ? row.topicName.trim() : undefined,
    chapterName: typeof row?.chapterName === 'string' ? row.chapterName.trim() : undefined,
    requirementName:
      typeof row?.requirementName === 'string' ? row.requirementName.trim() : undefined,
  };
}

function normalizeRequirementContext(value: unknown) {
  const row = (value ?? null) as { materialSnippets?: unknown } | null;
  const materialSnippets = Array.isArray(row?.materialSnippets)
    ? row.materialSnippets
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter(Boolean)
        .slice(0, 12)
    : [];
  return { materialSnippets };
}

function normalizeHistory(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((message) => {
      const row = (message ?? null) as { role?: unknown; content?: unknown } | null;
      if (
        !row ||
        (row.role !== 'assistant' && row.role !== 'user') ||
        typeof row.content !== 'string' ||
        !row.content.trim()
      ) {
        return null;
      }
      return { role: row.role, content: row.content.trim() };
    })
    .filter(
      (message): message is { role: 'user' | 'assistant'; content: string } => message != null,
    );
}

function normalizeFlashcards(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((card) => {
      const row = (card ?? null) as { front?: unknown; back?: unknown } | null;
      const front = typeof row?.front === 'string' ? row.front.trim() : '';
      const back = typeof row?.back === 'string' ? row.back.trim() : '';
      return front && back ? { front, back } : null;
    })
    .filter((card): card is { front: string; back: string } => card != null)
    .slice(0, 8);
}

function extractAssistantText(value: unknown): string {
  const output = Array.isArray((value as { output?: unknown } | null)?.output)
    ? ((value as { output: unknown[] }).output ?? [])
    : [];
  const parts: string[] = [];
  for (const item of output) {
    const content = Array.isArray((item as { content?: unknown } | null)?.content)
      ? ((item as { content: unknown[] }).content ?? [])
      : [];
    for (const chunk of content) {
      if ((chunk as { type?: unknown }).type === 'output_text') {
        const text = (chunk as { text?: unknown }).text;
        if (typeof text === 'string' && text.trim()) parts.push(text);
      }
    }
  }
  return parts.join('\n').trim();
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text) as { flashcards?: unknown };
  } catch {
    return null;
  }
}

function assertEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} fehlt`);
  return value;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
