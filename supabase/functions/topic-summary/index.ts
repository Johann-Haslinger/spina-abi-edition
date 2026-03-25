// Supabase Edge Function: KI-Kurzüberblick zum Themensstand (nur Text, aus statischem Client-Payload).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-auth',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

type ExerciseStatusCounts = {
  unknown: number;
  partial: number;
  captured: number;
  covered: number;
};

type TopicSummaryPayload = {
  topicName?: string;
  subjectName?: string;
  avgRequirementMastery: number;
  requirementCount: number;
  weakRequirementCount: number;
  chapters: TopicChapterSnapshot[];
  weakest: TopicWeakest[];
  completedSessionCount: number;
  totalAttempts: number;
  totalWorkTimeFormatted: string;
  exerciseAssetCount: number;
  exerciseStatusCounts: ExerciseStatusCounts;
  unknownExerciseRatio: number;
};

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

    const body = (await req.json()) as { topic?: unknown };
    if (!body.topic || typeof body.topic !== 'object') {
      return json(400, { error: 'topic payload fehlt' });
    }

    const apiKey = assertEnv('OPENAI_API_KEY');
    const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4.1-mini';
    const payloadJson = JSON.stringify(body.topic);

    const prompt = [
      'Du schreibst eine kurze, ermutigende Standort-Bestimmung zum Themenfortschritt für eine:r Abi-Schüler:in.',
      'Daten (nur JSON, keine weiteren Quellen):',
      payloadJson,
      '',
      'Hinweis: Alle Zeiten sind als lesbare deutsche Kurzform angegeben — nicht in Sekunden.',
      '',
      'Regeln:',
      '- Antworte NUR als JSON mit genau diesem Schema:',
      '{ "summary": string }',
      '- summary: 2–5 zusammenhängende Sätze auf Deutsch.',
      '- Verknüpfe den geschätzten Könnensstand (avgRequirementMastery als Durchschnitt 0–1, inhaltlich als Prozent verstanden) mit Kapiteln/schwachen Skills, Lernaktivität (Sessions, Versuche, Arbeitszeit) und der Verteilung der Übungs-Assets nach Status (unknown/teilweise/erfasst/abgedeckt).',
      '- Keine erfundenen Zahlen — nutze ausschließlich Werte aus dem JSON.',
      '- Kein Abiturdatum und keine Lernplanung erwähnen (keine Daten dafür).',
    ].join('\n');

    const openaiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_output_tokens: 700,
        input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
      }),
    });

    if (!openaiRes.ok) return json(500, { error: await openaiRes.text() });
    const openaiJson = await openaiRes.json();
    const parsed = safeJsonParse(extractAssistantText(openaiJson));
    if (!parsed || typeof parsed !== 'object') {
      return json(500, { error: 'Summary-Antwort konnte nicht gelesen werden' });
    }

    const summary = asNonEmptyString((parsed as Record<string, unknown>).summary) ?? '';
    if (!summary) {
      return json(500, { error: 'summary fehlt in der Antwort' });
    }

    return json(200, { summary } satisfies { summary: string });
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
