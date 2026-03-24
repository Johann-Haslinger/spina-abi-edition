// Supabase Edge Function: study-ai
// Receives chat messages + (cached) PDF and forwards to OpenAI.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

type InputMessage = { role: 'user' | 'assistant'; content: string };

type ReqBody = {
  conversationKey: string;
  docId?: string;
  openAiFileId?: string;
  pdfBase64?: string;
  pdfFilename?: string;
  messages: InputMessage[];
  attemptImageDataUrl?: string;
  requireAttemptImage?: boolean;
};

type CachedOpenAiFile = {
  fileId: string;
  updatedAtMs: number;
};

const OPENAI_FILE_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const openAiFileCache = new Map<string, CachedOpenAiFile>();

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-auth',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function newReqId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `req_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
  }
}

function safeSnippet(s: string, maxLen = 400) {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length <= maxLen ? t : `${t.slice(0, maxLen)}…`;
}

function log(reqId: string, msg: string, extra?: Record<string, unknown>) {
  const base = { reqId, msg, ...(extra ?? {}) };
  // deno-lint-ignore no-console
  console.log(JSON.stringify(base));
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function cleanupOpenAiFileCache(nowMs: number) {
  for (const [docId, entry] of openAiFileCache.entries()) {
    if (nowMs - entry.updatedAtMs > OPENAI_FILE_CACHE_TTL_MS) openAiFileCache.delete(docId);
  }
}

function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer as ArrayBuffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function uploadPdfToOpenAiFile(args: {
  reqId: string;
  openaiKey: string;
  pdfBytes: Uint8Array;
  pdfFilename: string;
}) {
  const form = new FormData();
  form.append('purpose', 'user_data');
  form.append(
    'file',
    new Blob([args.pdfBytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' }),
    args.pdfFilename || 'exercise.pdf',
  );

  const res = await fetch('https://api.openai.com/v1/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${args.openaiKey}` },
    body: form,
  });

  if (!res.ok) {
    const t = await res.text();
    log(args.reqId, 'openai_file_upload_failed', {
      status: res.status,
      bodySnippet: safeSnippet(t, 800),
    });
    throw new Error(`OpenAI file upload error: ${res.status}`);
  }

  const j = (await res.json()) as { id?: unknown };
  if (typeof j.id !== 'string' || !j.id) throw new Error('OpenAI file upload returned no file id');

  return j.id;
}

function assertEnv(name: string) {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
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
  const joined = parts.join('\n').trim();
  return joined || 'Keine Antwort.';
}

serve(async (req) => {
  const reqId = newReqId();
  const startedAt = Date.now();
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

    const body = (await req.json()) as ReqBody;
    if (!body || typeof body !== 'object') return jsonResponse(400, { error: 'Bad request' });
    if (!body.conversationKey) return jsonResponse(400, { error: 'conversationKey fehlt' });
    if (!Array.isArray(body.messages) || body.messages.length === 0)
      return jsonResponse(400, { error: 'messages fehlt' });

    log(reqId, 'request_received', {
      conversationKey: safeSnippet(String(body.conversationKey), 120),
      hasOpenAiFileId:
        (typeof body.openAiFileId === 'string' && Boolean(body.openAiFileId)) ||
        (typeof body.docId === 'string' && Boolean(body.docId)),
      hasPdfBase64: typeof body.pdfBase64 === 'string' && Boolean(body.pdfBase64),
      pdfBase64Chars: typeof body.pdfBase64 === 'string' ? body.pdfBase64.length : 0,
      messagesCount: body.messages.length,
      hasAttemptImage:
        typeof body.attemptImageDataUrl === 'string' && Boolean(body.attemptImageDataUrl),
      attemptImageChars:
        typeof body.attemptImageDataUrl === 'string' ? body.attemptImageDataUrl.length : 0,
      userAgent: req.headers.get('user-agent') ?? '',
    });

    const openaiKey = assertEnv('OPENAI_API_KEY');

    cleanupOpenAiFileCache(Date.now());

    const requestedOpenAiFileId =
      typeof body.openAiFileId === 'string' && body.openAiFileId
        ? body.openAiFileId
        : typeof body.docId === 'string' && body.docId && !/^[a-f0-9]{64}$/i.test(body.docId)
        ? body.docId
        : null;
    const pdfB64 = typeof body.pdfBase64 === 'string' ? body.pdfBase64 : '';
    const hasPdf = Boolean(pdfB64);
    if (!hasPdf && !requestedOpenAiFileId)
      return jsonResponse(400, { error: 'pdfBase64 oder openAiFileId fehlt' });

    const pdfBytes = hasPdf ? b64ToBytes(pdfB64) : null;
    const pdfHash = pdfBytes ? await sha256Hex(pdfBytes) : null;
    const pdfFilename =
      typeof body.pdfFilename === 'string' && body.pdfFilename ? body.pdfFilename : 'exercise.pdf';

    const cachedFile = pdfHash ? (openAiFileCache.get(pdfHash) ?? null) : null;
    let pdfFileId = requestedOpenAiFileId ?? cachedFile?.fileId ?? null;
    if (!pdfFileId && pdfBytes) {
      pdfFileId = await uploadPdfToOpenAiFile({ reqId, openaiKey, pdfBytes, pdfFilename });
      if (pdfHash) {
        openAiFileCache.set(pdfHash, { fileId: pdfFileId, updatedAtMs: Date.now() });
      }
    }
    if (!pdfFileId) return jsonResponse(400, { error: 'openAiFileId konnte nicht bestimmt werden' });

    const attemptImageDataUrl =
      typeof body.attemptImageDataUrl === 'string' && body.attemptImageDataUrl
        ? body.attemptImageDataUrl
        : null;
    const requireAttemptImage = body.requireAttemptImage === true;
    if (requireAttemptImage && !attemptImageDataUrl) {
      return jsonResponse(400, { error: 'attemptImageDataUrl fehlt für aktuellen Attempt' });
    }
    if (attemptImageDataUrl)
      log(reqId, 'attempt_image_attached', { chars: attemptImageDataUrl.length });

    // Attach the PDF (+ optional image) to the last user message.
    const lastUserIdx = (() => {
      for (let i = body.messages.length - 1; i >= 0; i--)
        if (body.messages[i]?.role === 'user') return i;
      return -1;
    })();
    if (lastUserIdx === -1) return jsonResponse(400, { error: 'Kein user message gefunden' });

    const input = [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text: 'Du bist ein Tutor für Mathe-Abi Aufgaben. Nutze nur Informationen aus der angehängten Aufgabe und markiere Annahmen klar. Wenn ein Nutzerloesungs-Bild angehaengt ist, beziehe dich explizit auf diesen Rechenweg. Antworte in knappen, nummerierten Schritten. Wenn die Angaben nicht reichen, stelle zuerst eine praezise Rueckfrage statt zu raten. Nenne am Ende eine kurze Plausibilitaetspruefung des Ergebnisses.',
          },
        ],
      },
      ...body.messages.map((m, idx) => {
        const base: Array<Record<string, unknown>> =
          m.role === 'assistant'
            ? [{ type: 'output_text', text: m.content }]
            : [{ type: 'input_text', text: m.content }];
        if (idx === lastUserIdx) {
          if (pdfFileId) {
            base.push({ type: 'input_file', file_id: pdfFileId });
          } else if (pdfB64) {
            // Fallback if no cached file id exists.
            base.push({
              type: 'input_file',
              filename: pdfFilename,
              file_data: `data:application/pdf;base64,${pdfB64}`,
            });
          }
          if (attemptImageDataUrl)
            base.push({ type: 'input_image', image_url: attemptImageDataUrl, detail: 'auto' });
        }
        return { role: m.role, content: base };
      }),
    ];

    // Use a PDF-capable model by default; can be overridden via env.
    const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4.1-mini';
    log(reqId, 'openai_request_start', {
      model,
      pdfFilename,
      pdfBytes: pdfBytes?.byteLength ?? 0,
      hasCachedFileId: Boolean(pdfFileId),
      messagesCount: body.messages.length,
      lastUserIdx,
    });

    const openaiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input,
        temperature: 0.2,
        max_output_tokens: 900,
      }),
    });

    if (!openaiRes.ok) {
      const t = await openaiRes.text();
      log(reqId, 'openai_request_failed', {
        status: openaiRes.status,
        bodySnippet: safeSnippet(t, 800),
      });
      return jsonResponse(500, { error: `OpenAI error: ${openaiRes.status} ${t}` });
    }
    const openaiJson = await openaiRes.json();
    const assistantMessage = extractAssistantText(openaiJson);

    log(reqId, 'request_ok', {
      openAiFileId: pdfFileId,
      assistantChars: assistantMessage.length,
      ms: Date.now() - startedAt,
    });
    return jsonResponse(200, {
      docId: pdfFileId,
      openAiFileId: pdfFileId,
      assistantMessage,
    });
  } catch (e) {
    log(reqId, 'request_exception', {
      ms: Date.now() - startedAt,
      error: e instanceof Error ? e.message : String(e),
    });
    return jsonResponse(500, { error: e instanceof Error ? e.message : 'Unknown error' });
  }
});
