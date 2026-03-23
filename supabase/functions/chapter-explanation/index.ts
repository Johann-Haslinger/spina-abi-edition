import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-auth',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

    const body = (await req.json()) as {
      subjectName?: string;
      topicName?: string;
      chapterName?: string;
      chapterDescription?: string;
      weakRequirementNames?: string[];
      requirements?: Array<{
        name: string;
        description?: string;
        difficulty: number;
        mastery: number;
      }>;
    };
    if (!body.subjectName || !body.topicName || !body.chapterName) {
      return json(400, { error: 'Kontext fehlt' });
    }

    const apiKey = assertEnv('OPENAI_API_KEY');
    const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4.1-mini';
    const prompt = [
      'Erzeuge ein kompaktes deutsches Merkblatt fuer eine Abi-Lern-App.',
      'Antworte nur als JSON mit { "title": string, "markdown": string }.',
      `Fach: ${body.subjectName}`,
      `Thema: ${body.topicName}`,
      `Kapitel: ${body.chapterName}`,
      `Beschreibung: ${body.chapterDescription ?? ''}`,
      `Requirements: ${JSON.stringify(body.requirements ?? [])}`,
      `Schwaechen: ${JSON.stringify(body.weakRequirementNames ?? [])}`,
      'Markdown soll enthalten: Kurzueberblick, typische Fehler, Beispiele, 2 Mini-Aufgaben.',
    ].join('\n');

    const openaiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_output_tokens: 1500,
        input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
      }),
    });
    if (!openaiRes.ok) return json(500, { error: await openaiRes.text() });
    const openaiJson = await openaiRes.json();
    const parsed = safeJsonParse(extractAssistantText(openaiJson));
    if (!parsed || typeof parsed.title !== 'string' || typeof parsed.markdown !== 'string') {
      return json(500, { error: 'Merkblatt konnte nicht gelesen werden' });
    }
    return json(200, { title: parsed.title, markdown: parsed.markdown });
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
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(cleaned) as { title?: unknown; markdown?: unknown };
  } catch {
    return null;
  }
}

function assertEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
