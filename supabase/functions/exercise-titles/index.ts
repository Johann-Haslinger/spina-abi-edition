// Supabase Edge Function: Lesbare Übungstitel aus Dateinamen (nur Namen, keine PDF-Inhalte).

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

const MAX_NAMES = 30;

type ReqBody = {
  fileNames?: unknown;
  namingInstruction?: unknown;
};

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

    const body = (await req.json()) as ReqBody;
    if (!Array.isArray(body.fileNames) || body.fileNames.length === 0) {
      return json(400, { error: 'fileNames muss ein nicht-leeres Array sein' });
    }
    if (body.fileNames.length > MAX_NAMES) {
      return json(400, { error: `Maximal ${MAX_NAMES} Dateinamen erlaubt` });
    }
    const fileNames: string[] = [];
    for (const x of body.fileNames) {
      if (typeof x !== 'string' || !x.trim()) {
        return json(400, { error: 'Jeder Dateiname muss ein nicht-leerer String sein' });
      }
      fileNames.push(x.trim());
    }
    const namingInstruction =
      typeof body.namingInstruction === 'string' && body.namingInstruction.trim()
        ? body.namingInstruction.trim()
        : null;

    const apiKey = assertEnv('OPENAI_API_KEY');
    const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4.1-mini';

    const listJson = JSON.stringify(fileNames);
    const prompt = [
      'Du erzeugst kurze, lesbare deutsche Titel für Schul-/Abi-Übungen.',
      'Es werden NUR die Original-Dateinamen geliefert (können Kürzel, Tippfehler, Nummern enthalten).',
      'Erforsche sinnvolle Themen (z. B. Analysis, CAS, Wahrscheinlichkeit) aus dem Namen und formuliere einen klaren Titel.',
      namingInstruction
        ? `Zusätzlicher Benennungswunsch der Nutzer: ${JSON.stringify(namingInstruction)}`
        : 'Es wurde kein zusätzlicher Benennungswunsch angegeben.',
      'Regeln:',
      '- Antworte NUR als JSON mit genau diesem Schema: { "titles": string[] }',
      `- "titles" muss genau ${fileNames.length} Einträge haben, gleiche Reihenfolge wie die Eingabe.`,
      '- Jeder Titel: ohne Dateiendung, ohne ".pdf", max. ca. 80 Zeichen, konkret und verständlich.',
      '- Keine Anführungszeichen im Titelstring selbst; vermeide ALL CAPS.',
      '- Wenn der Name nichtssagend ist (z. B. nur "scan1"), nutze einen neutralen Titel wie "Übungscan" plus ggf. Nummer aus dem Namen.',
      'Eingabe-Dateinamen (JSON-Array):',
      listJson,
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
        max_output_tokens: Math.min(800, 80 * fileNames.length + 100),
        input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
      }),
    });

    if (!openaiRes.ok) return json(500, { error: await openaiRes.text() });
    const openaiJson = await openaiRes.json();
    const parsed = safeJsonParse(extractAssistantText(openaiJson));
    if (!parsed || typeof parsed !== 'object') {
      return json(500, { error: 'Titel-Antwort konnte nicht gelesen werden' });
    }
    const titlesRaw = (parsed as Record<string, unknown>).titles;
    if (!Array.isArray(titlesRaw)) {
      return json(500, { error: 'titles fehlt oder ist kein Array' });
    }
    const titles: string[] = [];
    for (const t of titlesRaw) {
      if (typeof t !== 'string' || !t.trim()) {
        return json(500, { error: 'Ungültiger Titel in der Antwort' });
      }
      titles.push(sanitizeTitle(t.trim()));
    }
    if (titles.length !== fileNames.length) {
      return json(500, { error: `Erwarte ${fileNames.length} Titel, erhalten: ${titles.length}` });
    }

    return json(200, { titles });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

function sanitizeTitle(s: string): string {
  return s.replace(/\.pdf$/i, '').replace(/\s+/g, ' ').slice(0, 120);
}

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
