import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-auth',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type CachedOpenAiFile = {
  fileId: string;
  updatedAtMs: number;
};

const OPENAI_FILE_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const openAiFileCache = new Map<string, CachedOpenAiFile>();

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
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function uploadPdfToOpenAiFile(args: {
  openaiKey: string;
  pdfBytes: Uint8Array;
  pdfFilename: string;
}) {
  const form = new FormData();
  form.append('purpose', 'user_data');
  form.append(
    'file',
    new Blob([args.pdfBytes], { type: 'application/pdf' }),
    args.pdfFilename || 'exercise.pdf',
  );

  const res = await fetch('https://api.openai.com/v1/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${args.openaiKey}` },
    body: form,
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI file upload error: ${res.status} ${t}`);
  }

  const j = (await res.json()) as { id?: unknown };
  if (typeof j.id !== 'string' || !j.id) throw new Error('OpenAI file upload returned no file id');
  return j.id;
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

    const body = (await req.json()) as {
      attemptId?: string;
      assetId?: string;
      subjectId?: string;
      topicId?: string;
      problemIdx?: number;
      subproblemLabel?: string;
      subsubproblemLabel?: string;
      pdfBase64?: string;
      attemptImageDataUrl?: string;
      usedAiHelp?: boolean;
      chapters?: Array<{ id: string; name: string; description?: string }>;
      requirements?: Array<{
        id: string;
        chapterId: string;
        name: string;
        description?: string;
        difficulty: number;
        mastery: number;
      }>;
    };

    if (!body.attemptImageDataUrl || !body.pdfBase64) {
      return json(400, { error: 'attemptImageDataUrl oder pdfBase64 fehlt' });
    }

    const apiKey = assertEnv('OPENAI_API_KEY');
    const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4.1-mini';
    const usedAiHelp = body.usedAiHelp === true;
    const requirements = Array.isArray(body.requirements) ? body.requirements : [];
    const chapters = Array.isArray(body.chapters) ? body.chapters : [];
    cleanupOpenAiFileCache(Date.now());

    // Upload the PDF once and reference it by file_id.
    // This avoids sending huge base64 inline payloads to `/v1/responses`.
    const pdfBytes = b64ToBytes(body.pdfBase64);
    const docId = await sha256Hex(pdfBytes);
    const cachedFile = openAiFileCache.get(docId) ?? null;
    let pdfFileId = cachedFile?.fileId ?? null;
    if (!pdfFileId) {
      pdfFileId = await uploadPdfToOpenAiFile({
        openaiKey: apiKey,
        pdfBytes,
        pdfFilename: 'exercise.pdf',
      });
      openAiFileCache.set(docId, { fileId: pdfFileId, updatedAtMs: Date.now() });
    }

    const prompt = [
      'Du bewertest eine Abi-Lernaufgabe.',
      'Antworte nur als JSON mit diesem Schema:',
      '{',
      '  "score": number,',
      '  "result": "correct" | "partial" | "wrong",',
      '  "messageToUser"?: string,',
      '  "notes"?: string,',
      '  "errorExplanation"?: string,',
      '  "solutionExplanation"?: string,',
      '  "manualFallbackReason"?: string,',
      '  "scheduleReview"?: { "dueAtMs": number },',
      '  "chapterIds": string[],',
      '  "requirements": [{ "requirementId"?: string, "requirementName": string, "confidence": number, "masteryDelta": number }]',
      '}',
      'Bewerte nach Ergebnis (40%), Rechenweg (40%), Verständnis (20%).',
      'Kleine Rundungsabweichungen oder leicht andere aber aequivalente Schreibweise (z.B. 0,33 vs 1/3, nur anderer Zwischenschritt) gelten als korrekt. Nur bei inhaltlich falschem Ergebnis oder wesentlichem Logikfehler setze partial oder wrong.',
      'Abi-Lernen bedeutet viele Attempts pro Thema. Ein einzelner Attempt darf nur ein sehr kleines Fortschrittssignal sein.',
      'Vergib masteryDelta deshalb sehr sparsam. Typisch pro Requirement etwa -0.01 bis 0.015 je nach Evidenz; niemals grosse Spruenge.',
      'Auch bei result = partial duerfen passende Requirements einen kleinen positiven masteryDelta bekommen, der aber geringer ausfaellt als bei clearly correct.',
      usedAiHelp
        ? 'StudyAI-Hilfe wurde bei diesem Attempt genutzt: Vergib trotzdem kleine masteryDelta-Werte wo angebracht, aber staerker konservativ als ohne Hilfe. Erwaehne in messageToUser knapp, dass der Fortschritt wegen KI-Hilfe begrenzt ist, ohne zu behaupten es gaebe gar keinen Fortschritt.'
        : 'Ohne KI-Hilfe: vergib realistische, kleine masteryDelta-Werte.',
      'Feld notes: Kurze, kontextfreie Lernerinnerung fuer den Nutzer (max 1-2 Saetze). Keine Aufgabenstellung zitieren, keine konkreten Zahlen aus dieser Aufgabe. Nur uebertragbare Fehlermuster oder Staerken (z.B. Rechenweg sauber, Einheiten pruefen, etc.).',
      `Teilaufgabe: ${formatTaskPath(body.problemIdx, body.subproblemLabel, body.subsubproblemLabel)}`,
      'Die eigentliche Nutzerlösung steckt im angehängten Bild.',
      `Kapitel: ${JSON.stringify(chapters)}`,
      `Requirements: ${JSON.stringify(requirements)}`,
      'Nutze nur Requirement-IDs, die in der Liste vorkommen.',
      'Setze scheduleReview nur, wenn die Leistung klar wiederholt werden sollte.',
      'Wenn du nicht sicher genug bist, setze manualFallbackReason.',
    ].join('\n');

    const openaiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_output_tokens: 1600,
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: prompt },
              { type: 'input_file', file_id: pdfFileId },
              {
                type: 'input_image',
                image_url: body.attemptImageDataUrl,
                detail: 'auto',
              },
            ],
          },
        ],
      }),
    });

    if (!openaiRes.ok) return json(500, { error: await openaiRes.text() });
    const openaiJson = await openaiRes.json();
    const parsed = safeJsonParse(extractAssistantText(openaiJson));
    if (!parsed || typeof parsed !== 'object') {
      return json(500, { error: 'Review-Antwort konnte nicht gelesen werden' });
    }

    const rawMessageToUser = asOptionalString(parsed.messageToUser);

    return json(200, {
      score: clampNumber(parsed.score, 0, 1, 0.5),
      result: normalizeResult(parsed.result),
      messageToUser: rawMessageToUser,
      notes: asOptionalString(parsed.notes),
      errorExplanation: asOptionalString(parsed.errorExplanation),
      solutionExplanation: asOptionalString(parsed.solutionExplanation),
      manualFallbackReason: asOptionalString(parsed.manualFallbackReason),
      scheduleReview:
        parsed.scheduleReview && typeof parsed.scheduleReview === 'object'
          ? {
              dueAtMs:
                Number((parsed.scheduleReview as { dueAtMs?: unknown }).dueAtMs) ||
                defaultDueAtMs(),
            }
          : undefined,
      chapterIds: Array.isArray(parsed.chapterIds)
        ? parsed.chapterIds.filter((value): value is string => typeof value === 'string')
        : [],
      requirements: Array.isArray(parsed.requirements)
        ? parsed.requirements
            .map((requirement) => {
              const row = (requirement ?? null) as Record<string, unknown> | null;
              if (!row || typeof row.requirementName !== 'string') return null;
              return {
                requirementId:
                  typeof row.requirementId === 'string' && row.requirementId
                    ? row.requirementId
                    : undefined,
                requirementName: row.requirementName,
                confidence: clampNumber(row.confidence, 0, 1, 0.5),
                masteryDelta: clampNumber(
                  row.masteryDelta,
                  usedAiHelp ? -0.01 : -0.02,
                  usedAiHelp ? 0.01 : 0.02,
                  0,
                ),
              };
            })
            .filter(Boolean)
        : [],
    });
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

function normalizeResult(value: unknown): 'correct' | 'partial' | 'wrong' {
  return value === 'correct' || value === 'wrong' || value === 'partial' ? value : 'partial';
}

function asOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

function defaultDueAtMs() {
  return Date.now() + 1000 * 60 * 60 * 24 * 2;
}

function formatTaskPath(
  problemIdx?: number,
  subproblemLabel?: string,
  subsubproblemLabel?: string,
) {
  const parts = [problemIdx ? String(problemIdx) : '?'];
  if (subproblemLabel?.trim()) parts.push(subproblemLabel.trim());
  if (subsubproblemLabel?.trim()) parts.push(subsubproblemLabel.trim());
  return parts.join('.');
}
