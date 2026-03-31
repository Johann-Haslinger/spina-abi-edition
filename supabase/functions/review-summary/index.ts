// Supabase Edge Function: Aggregiert Übungs-/Session-Metadaten zu einer KI-Zusammenfassung (nur Text).

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

type AttemptResult = 'correct' | 'partial' | 'wrong';

type ExerciseTotals = {
  attempts: number;
  correct: number;
  partial: number;
  wrong: number;
  workTime: string;
};

type ExerciseItem = {
  path: string;
  result: AttemptResult;
  duration: string;
};

type ExercisePayload = {
  title: string;
  totals: ExerciseTotals;
  items: ExerciseItem[];
};

type SessionExerciseSummary = {
  title: string;
  totals: ExerciseTotals;
};

type TopicChapterSnapshot = {
  name: string;
  avgMastery: number;
  requirementCount: number;
};

type TopicWeakest = {
  name: string;
  mastery: number;
};

type TopicContext = {
  topicName?: string;
  avgRequirementMastery: number;
  chapters: TopicChapterSnapshot[];
  weakest: TopicWeakest[];
};

type SessionPayload = {
  sessionKind?: 'exercise' | 'learnpath';
  sessionDuration: string;
  workTime: string;
  exerciseCount: number;
  totals: ExerciseTotals;
  exercises: SessionExerciseSummary[];
  topicContext: TopicContext;
  learnPath?: {
    requirementCount: number;
    completedCount: number;
    totalMasteryDeltaPercent: number;
    requirements: Array<{
      name: string;
      chapterName: string;
      mode: 'learn' | 'review';
      status: 'in_progress' | 'completed';
      duration: string;
      masteryDeltaPercent: number;
      summary?: string;
    }>;
  };
};

type ReqBody = {
  scope?: string;
  exercise?: ExercisePayload;
  session?: SessionPayload;
};

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

    const body = (await req.json()) as ReqBody;
    const scope = body.scope === 'exercise' || body.scope === 'session' ? body.scope : null;
    if (!scope) return json(400, { error: 'scope muss exercise oder session sein' });

    if (scope === 'exercise') {
      if (!body.exercise || typeof body.exercise !== 'object') {
        return json(400, { error: 'exercise payload fehlt' });
      }
    } else {
      if (!body.session || typeof body.session !== 'object') {
        return json(400, { error: 'session payload fehlt' });
      }
    }

    const apiKey = assertEnv('OPENAI_API_KEY');
    const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4.1-mini';

    const payloadJson =
      scope === 'exercise'
        ? JSON.stringify({ scope, exercise: body.exercise })
        : JSON.stringify({ scope, session: body.session });

    const prompt =
      scope === 'exercise'
        ? [
            'Du schreibst eine kurze Lernzusammenfassung für ein Abi-Schüler:in.',
            'Daten (nur JSON, keine weiteren Quellen):',
            payloadJson,
            '',
            'Hinweis: Alle Zeiten sind als lesbare deutsche Kurzform (Min bzw. Std) angegeben, z. B. "12 Min" oder "1 Std 20 Min" — nicht in Sekunden.',
            '',
            'Regeln:',
            '- Antworte NUR als JSON mit genau diesem Schema:',
            '{ "headline": string, "summary": string, "tip": string, "focusAreas": string[] }',
            '- Alles auf Deutsch, sachlich und ermutigend.',
            '- summary: 2–4 Sätze zur bearbeiteten Übung in dieser Session (Versuche, Zeiten, Trefferquote, ggf. KI-Prozente).',
            '- tip: EIN konkreter nächster Übungsschritt.',
            '- focusAreas: 2–4 kurze Stichpunkte (Strings), worauf beim nächsten Mal geachtet werden soll.',
            '- KEIN Bezug zum gesamten Themen-Curriculum oder langfristigen Themensstand — nur diese Übung und diese Versuche.',
            '- Keine erfundenen Zahlen; nutze nur die gelieferten Daten.',
          ].join('\n')
        : [
            'Du schreibst eine kurze Lernzusammenfassung nach einer Study-Session.',
            'Daten (nur JSON):',
            payloadJson,
            '',
            'Hinweis: Alle Zeiten sind als lesbare deutsche Kurzform (Min bzw. Std) angegeben — nicht in Sekunden.',
            '',
            'Regeln:',
            '- Antworte NUR als JSON mit genau diesem Schema:',
            '{ "headline": string, "summary": string, "tip": string, "focusAreas": string[] }',
            '- Alles auf Deutsch.',
            '- Wenn sessionKind="exercise": Verbinde Session-Ergebnisse (Versuche, Zeiten, richtig/teilweise/falsch) mit topicContext (Durchschnitts-Mastery, Kapitel, schwächste Requirements).',
            '- Wenn sessionKind="learnpath": Fasse bearbeitete Requirements, Lern-/Wiederholmodus, Completion, Mastery-Delta und die einzelnen Requirement-Summaries zusammen.',
            '- Erkläre kurz, wie die Session zum aktuellen Stand im Thema passt.',
            '- tip: EIN konkreter nächster Schritt (Session-Plan oder Übung).',
            '- focusAreas: 2–4 Strings — worauf künftig achten, optional mit Bezug zu schwachen Requirements.',
            '- Keine erfundenen Zahlen.',
          ].join('\n');

    const openaiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_output_tokens: 900,
        input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
      }),
    });

    if (!openaiRes.ok) return json(500, { error: await openaiRes.text() });
    const openaiJson = await openaiRes.json();
    const parsed = safeJsonParse(extractAssistantText(openaiJson));
    if (!parsed || typeof parsed !== 'object') {
      return json(500, { error: 'Summary-Antwort konnte nicht gelesen werden' });
    }

    const headline = asNonEmptyString(parsed.headline) ?? 'KI-Zusammenfassung';
    const summary = asNonEmptyString(parsed.summary) ?? '';
    const tip = asNonEmptyString(parsed.tip) ?? '';
    const focusAreas = normalizeFocusAreas(parsed.focusAreas);
    if (!summary || !tip) {
      return json(500, { error: 'Summary oder Tipp fehlt in der Antwort' });
    }

    return json(200, { headline, summary, tip, focusAreas });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

function extractAssistantText(r: unknown): string {
  const rr = (r ?? null) as Record<string, unknown> | null;
  const outputText = rr && typeof rr.output_text === 'string' ? rr.output_text : null;
  if (outputText && outputText.trim()) return outputText.trim();
  const out = rr && Array.isArray(rr.output) ? rr.output : [];
  const parts: string[] = [];
  for (const item of out) {
    const it = (item ?? null) as Record<string, unknown> | null;
    if (it?.type !== 'message' || it?.role !== 'assistant') continue;
    const content = Array.isArray(it?.content) ? (it.content as unknown[]) : [];
    for (const c of content) {
      const cc = (c ?? null) as Record<string, unknown> | null;
      if (cc?.type === 'output_text' && typeof cc?.text === 'string') parts.push(cc.text);
    }
  }
  return parts.join('\n').trim();
}

function safeJsonParse(text: string) {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asNonEmptyString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeFocusAreas(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is string => typeof x === 'string' && Boolean(x.trim()))
    .map((s) => s.trim())
    .slice(0, 6);
}

function assertEnv(name: string) {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
