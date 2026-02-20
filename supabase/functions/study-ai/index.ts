// Supabase Edge Function: study-ai
// Receives chat messages + (cached) PDF and forwards to OpenAI.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

type InputMessage = { role: 'user' | 'assistant'; content: string };

type ReqBody = {
  conversationKey: string;
  docId?: string;
  pdfBase64?: string;
  pdfFilename?: string;
  messages: InputMessage[];
  attemptImageDataUrl?: string;
};

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

function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
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
      hasDocId: typeof body.docId === 'string' && Boolean(body.docId),
      hasPdfBase64: typeof body.pdfBase64 === 'string' && Boolean(body.pdfBase64),
      pdfBase64Chars: typeof body.pdfBase64 === 'string' ? body.pdfBase64.length : 0,
      messagesCount: body.messages.length,
      hasAttemptImage: typeof body.attemptImageDataUrl === 'string' && Boolean(body.attemptImageDataUrl),
      attemptImageChars: typeof body.attemptImageDataUrl === 'string' ? body.attemptImageDataUrl.length : 0,
      userAgent: req.headers.get('user-agent') ?? '',
    });

    const supabaseUrl = assertEnv('SUPABASE_URL');
    const serviceRoleKey = assertEnv('SUPABASE_SERVICE_ROLE_KEY');
    const openaiKey = assertEnv('OPENAI_API_KEY');

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const bucket = Deno.env.get('STUDY_AI_BUCKET') || 'ai-pdfs';

    let docId = typeof body.docId === 'string' ? body.docId : '';
    let pdfBytes: Uint8Array | null = null;
    const pdfFilename =
      typeof body.pdfFilename === 'string' && body.pdfFilename ? body.pdfFilename : 'exercise.pdf';

    if (!docId) {
      const pdfB64 = typeof body.pdfBase64 === 'string' ? body.pdfBase64 : '';
      if (!pdfB64) return jsonResponse(400, { error: 'docId oder pdfBase64 fehlt' });
      pdfBytes = b64ToBytes(pdfB64);
      docId = await sha256Hex(pdfBytes);
      const path = `${docId}.pdf`;
      log(reqId, 'pdf_cache_miss_uploading', { bucket, path, pdfBytes: pdfBytes.byteLength });

      const uploadRes = await supabase.storage.from(bucket).upload(path, pdfBytes, {
        contentType: 'application/pdf',
        upsert: false,
      });
      // Ignore "already exists" errors; we can still proceed using cache.
      if (uploadRes.error && uploadRes.error.statusCode !== '409') {
        log(reqId, 'storage_upload_failed', {
          bucket,
          path,
          statusCode: uploadRes.error.statusCode,
          message: uploadRes.error.message,
        });
        return jsonResponse(500, {
          error: `Storage upload failed: ${uploadRes.error.message}. Bucket '${bucket}' vorhanden?`,
        });
      }
      log(reqId, 'storage_upload_ok', {
        bucket,
        path,
        existed: uploadRes.error?.statusCode === '409',
      });
    }

    if (!pdfBytes) {
      const path = `${docId}.pdf`;
      log(reqId, 'pdf_cache_hit_downloading', { bucket, path });
      const dl = await supabase.storage.from(bucket).download(path);
      if (dl.error || !dl.data) {
        log(reqId, 'storage_download_failed', {
          bucket,
          path,
          message: dl.error?.message ?? 'missing',
        });
        return jsonResponse(500, {
          error: `Storage download failed: ${dl.error?.message ?? 'missing'}. docId=${docId}`,
        });
      }
      const ab = await dl.data.arrayBuffer();
      pdfBytes = new Uint8Array(ab);
      log(reqId, 'storage_download_ok', { bucket, path, pdfBytes: pdfBytes.byteLength });
    }

    const pdfBase64ForOpenAI = bytesToB64(pdfBytes);

    const attemptImageDataUrl =
      typeof body.attemptImageDataUrl === 'string' && body.attemptImageDataUrl ? body.attemptImageDataUrl : null;
    if (attemptImageDataUrl) log(reqId, 'attempt_image_attached', { chars: attemptImageDataUrl.length });

    // Attach the PDF (+ optional image) to the last user message.
    const lastUserIdx = (() => {
      for (let i = body.messages.length - 1; i >= 0; i--) if (body.messages[i]?.role === 'user') return i;
      return -1;
    })();
    if (lastUserIdx === -1) return jsonResponse(400, { error: 'Kein user message gefunden' });

    const input = [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text:
              'Du bist ein Tutor für Mathe-Abi Aufgaben. Nutze die angehängte PDF als Quelle. Antworte klar, Schritt-für-Schritt, und kurz genug zum Mitschreiben. Wenn etwas fehlt, stelle gezielte Rückfragen.',
          },
        ],
      },
      ...body.messages.map((m, idx) => {
        const base = [{ type: 'input_text', text: m.content }];
        if (idx === lastUserIdx) {
          base.push({ type: 'input_file', filename: pdfFilename, file_data: pdfBase64ForOpenAI });
          if (attemptImageDataUrl) base.push({ type: 'input_image', image_url: attemptImageDataUrl, detail: 'auto' });
        }
        return { role: m.role, content: base };
      }),
    ];

    const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4.1-mini';
    log(reqId, 'openai_request_start', {
      model,
      pdfFilename,
      pdfBytes: pdfBytes.byteLength,
      pdfBase64Chars: pdfBase64ForOpenAI.length,
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

    log(reqId, 'request_ok', { docId, assistantChars: assistantMessage.length, ms: Date.now() - startedAt });
    return jsonResponse(200, { docId, assistantMessage });
  } catch (e) {
    log(reqId, 'request_exception', {
      ms: Date.now() - startedAt,
      error: e instanceof Error ? e.message : String(e),
    });
    return jsonResponse(500, { error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

