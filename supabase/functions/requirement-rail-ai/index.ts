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

function safeSnippet(s: string, maxLen = 500) {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length <= maxLen ? t : `${t.slice(0, maxLen)}…`;
}

const RAIL_STATES = [
  'intro',
  'explain_core',
  'explain_detail',
  'check_short',
  'reinforce',
  'check_final',
  'requirement_complete',
] as const;

type RailState = (typeof RAIL_STATES)[number];

type ReqBody = {
  requirementGoal?: unknown;
  currentState?: unknown;
  allowedNextStates?: unknown;
  history?: unknown;
  lastUserMessage?: unknown;
  chapterContext?: unknown;
};

type HistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

function newReqId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `req_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
  }
}

function log(reqId: string, event: string, extra?: Record<string, unknown>) {
  // deno-lint-ignore no-console
  console.log(JSON.stringify({ reqId, event, ...(extra ?? {}) }));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

serve(async (req) => {
  const reqId = newReqId();
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

    const body = (await req.json()) as ReqBody;
    const requirementGoal =
      typeof body.requirementGoal === 'string' ? body.requirementGoal.trim() : '';
    if (!requirementGoal) return json(400, { error: 'requirementGoal fehlt' });

    if (!isRailState(body.currentState)) return json(400, { error: 'currentState ist ungueltig' });
    const currentState = body.currentState;

    if (!Array.isArray(body.allowedNextStates) || body.allowedNextStates.length === 0) {
      return json(400, { error: 'allowedNextStates fehlt oder ist leer' });
    }
    const allowedNextStates = body.allowedNextStates.filter(isRailState);
    if (allowedNextStates.length === 0) {
      return json(400, { error: 'allowedNextStates enthaelt keine gueltigen States' });
    }

    const history = normalizeHistory(body.history);
    const chapterContext = normalizeChapterContext(body.chapterContext);
    const lastUserMessage =
      typeof body.lastUserMessage === 'string' && body.lastUserMessage.trim()
        ? body.lastUserMessage.trim()
        : undefined;

    const apiKey = assertEnv('OPENAI_API_KEY');
    const model = Deno.env.get('OPENAI_MODEL') || 'gpt-5.2';
    const prompt = [
      'Du steuerst den Wissenspfad einer Abi-Lern-App fuer lehrplanbasiertes Lernen.',
      'Antworte NUR als JSON mit genau diesem Schema:',
      '{ "message": string, "suggested_next_state"?: string, "mastery_delta"?: number, "await_user_reply"?: boolean }',
      '',
      'Wichtige Steuerregel:',
      '- Antworte inhaltlich IMMER fuer den aktuellen State.',
      '- Wenn du in einen erlaubten naechsten State wechseln willst, setze suggested_next_state.',
      '- Wenn du im selben State bleiben willst, lasse suggested_next_state weg.',
      '- Ausnahme: Wenn suggested_next_state = "requirement_complete", dann darf die message bereits die Abschlussnachricht sein.',
      '- suggested_next_state darf nur einer der erlaubten naechsten States sein.',
      '- mastery_delta darf NUR gesetzt werden, wenn suggested_next_state = "requirement_complete".',
      '- await_user_reply=true bedeutet: stoppe hier und warte auf eine Nutzerantwort, auch wenn der State gleich bleibt.',
      '- mastery_delta ist ein Delta im Bereich 0..1, typisch 0.08 bis 0.15 fuer ein abgeschlossenes Requirement.',
      '- Schreibe auf Deutsch, klar, freundlich, lernorientiert und inhaltlich substanziell.',
      '',
      'Rail-State-Ziele:',
      '- intro: NUR Requirement einfuehren, Ziel und Relevanz nennen. Keine inhaltliche Kern-Erklaerung und keine Details.',
      '- explain_core: Kernidee einfach erklaeren.',
      '- explain_detail: Details, Struktur oder Beispiel ergaenzen.',
      '- check_short: kurze Zwischenabfrage stellen.',
      '- reinforce: auf die letzte Nutzerantwort reagieren, korrigieren oder verstaerken.',
      '- check_final: groessere Abschlussfrage stellen oder beantworten lassen.',
      '',
      `Requirement-Ziel: ${requirementGoal}`,
      `Aktueller State: ${currentState}`,
      `Erlaubte naechste States: ${JSON.stringify(allowedNextStates)}`,
      `Kapitelkontext: ${JSON.stringify(chapterContext)}`,
      `Letzte Nutzerantwort: ${JSON.stringify(lastUserMessage ? safeSnippet(lastUserMessage, 400) : null)}`,
      `Bisheriger Verlauf: ${safeSnippet(JSON.stringify(history), 2500)}`,
      '',
      'Zusatzregeln:',
      '- Erklaerungen duerfen und sollen haeufig in 2 bis 4 Nachrichten innerhalb desselben States stattfinden, bevor du weitergehst.',
      '- Wechsle NICHT vorschnell in den naechsten State. Bleibe lieber erst im aktuellen State und erklaere tiefer, gib ein Beispiel oder strukturiere den Gedanken in mehreren Schritten.',
      '- Stelle zwischendurch natuerliche Rueckfragen wie: "Ist das bis hierhin nachvollziehbar?", "Soll ich das an einem Beispiel zeigen?" oder "Soll ich auf einen Punkt noch genauer eingehen?".',
      '- Wenn du so eine Rueckfrage stellst oder bewusst auf Feedback wartest, setze await_user_reply=true.',
      '- SPECIAL INTRO RULE: Bei currentState=intro MUSST du suggested_next_state="explain_core" setzen, sobald die kurze Einfuehrung abgeschlossen ist. In intro niemals fachliche Tiefe erklaeren.',
      '- In intro/explain_core/explain_detail/reinforce ist ein State-Wechsel oft erst sinnvoll, wenn du mindestens eine gehaltvolle Erklaerung gegeben hast und der Nutzer Gelegenheit zur Reaktion hatte.',
      '- Wenn currentState ein Fragestate ist und noch keine gute Nutzerantwort vorliegt, bleibe im aktuellen State und stelle genau eine passende Frage.',
      '- Wenn die Nutzerantwort im Kern sitzt, wechsle bei check_short zu reinforce und bei check_final zu requirement_complete.',
      '- Wenn die Nutzerantwort noch nicht reicht, bleibe im aktuellen Fragestate oder schliesse bei reinforce eine Luecke, bevor du weitergehst.',
      '- Keine Markdown-Tabellen, kein JSON ausserhalb des geforderten Schemas.',
    ].join('\n');

    log(reqId, 'openai_request_start', {
      model,
      currentState,
      allowedNextStates,
      promptChars: prompt.length,
      historyCount: Array.isArray(body.history) ? body.history.length : 0,
    });

    let openaiJson: unknown = null;
    let parsed: Record<string, unknown> | null = null;
    let openaiStatus: number | null = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const openaiRes = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_output_tokens: 650,
          input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
        }),
      });

      openaiStatus = openaiRes.status;

      if (!openaiRes.ok) {
        const errText = await openaiRes.text().catch(() => '');
        log(reqId, 'openai_not_ok', {
          attempt,
          openaiStatus,
          errorSnippet: safeSnippet(errText, 900),
        });

        // Retry bei transienten Fehlern.
        if (attempt === 0 && (openaiStatus === 429 || openaiStatus >= 500)) {
          await sleep(500 + attempt * 500);
          continue;
        }

        return json(200, {
          message:
            openaiStatus === 429
              ? 'Ich bin gerade kurz an einem Rate-Limit gescheitert. Bitte sende deine nächste Antwort erneut oder versuche es gleich nochmal.'
              : 'Ich hatte kurz technische Probleme, deine Lernerunde fortzusetzen. Bitte sende deine nächste Antwort erneut oder versuche es gleich nochmal.',
        });
      }

      openaiJson = await openaiRes.json();
      parsed = safeJsonParse(extractAssistantText(openaiJson));
      break;
    }

    if (!parsed || typeof parsed !== 'object') {
      log(reqId, 'parse_failed', {
        openaiStatus,
        assistantSnippet: extractAssistantText(openaiJson).slice(0, 300),
      });
      return json(200, {
        message:
          'Ich konnte meine letzte Antwort leider nicht zuverlässig als Schritt im Wissenspfad einordnen. Bitte antworte nochmal auf die Frage des aktuellen Schritts.',
      });
    }

    const message = asNonEmptyString((parsed as Record<string, unknown>).message) ?? '';
    if (!message) {
      return json(200, {
        message:
          'Es ist ein kleines Formatproblem aufgetreten. Bitte antworte nochmal auf die Frage des aktuellen Schritts.',
      });
    }

    const rawSuggested = (parsed as Record<string, unknown>).suggested_next_state;
    const suggestedNextState =
      isRailState(rawSuggested) && allowedNextStates.includes(rawSuggested)
        ? rawSuggested
        : undefined;

    const rawMasteryDelta = (parsed as Record<string, unknown>).mastery_delta;
    const masteryDelta =
      suggestedNextState === 'requirement_complete'
        ? clampMasteryDelta(
            typeof rawMasteryDelta === 'number' && Number.isFinite(rawMasteryDelta)
              ? rawMasteryDelta
              : 0.12,
          )
        : undefined;
    const awaitUserReply = (parsed as Record<string, unknown>).await_user_reply === true;

    return json(200, {
      message,
      suggested_next_state: suggestedNextState,
      mastery_delta: masteryDelta,
      await_user_reply: awaitUserReply,
    });
  } catch {
    // Fail-soft bei unerwarteten Runtime-Fehlern.
    log(reqId, 'unexpected_error', {});
    return json(200, {
      message:
        'Es gab einen unerwarteten technischen Fehler beim Wissenspfad. Bitte versuche es erneut (oder sende deine Antwort nochmal).',
    });
  }
});

function normalizeHistory(input: unknown): HistoryMessage[] {
  if (!Array.isArray(input)) return [];
  const out: HistoryMessage[] = [];
  for (const entry of input) {
    const row = (entry ?? null) as Record<string, unknown> | null;
    if (!row) continue;
    const role = row.role;
    const content = typeof row.content === 'string' ? row.content.trim() : '';
    if ((role === 'user' || role === 'assistant') && content) {
      out.push({ role, content: safeSnippet(content, 420) });
    }
  }
  return out.slice(-12);
}

function normalizeChapterContext(input: unknown) {
  const row = (input ?? null) as Record<string, unknown> | null;
  if (!row) return null;
  return {
    subjectName: asNonEmptyString(row.subjectName),
    topicName: asNonEmptyString(row.topicName),
    chapterName: asNonEmptyString(row.chapterName),
    requirementName: asNonEmptyString(row.requirementName),
  };
}

function isRailState(value: unknown): value is RailState {
  return typeof value === 'string' && RAIL_STATES.includes(value as RailState);
}

function clampMasteryDelta(value: number) {
  return Math.max(0, Math.min(0.2, value));
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
    // Fallback: versuche ein JSON-Objekt im Text zu lokalisieren.
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      const candidate = cleaned.slice(start, end + 1);
      try {
        return JSON.parse(candidate) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function asNonEmptyString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
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
