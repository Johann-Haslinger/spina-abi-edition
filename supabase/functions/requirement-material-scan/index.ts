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
  subjectName?: unknown;
  topicName?: unknown;
  files?: unknown;
  targets?: unknown;
};

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

    const body = (await req.json()) as ReqBody;
    const files = normalizeFiles(body.files);
    const targets = normalizeTargets(body.targets);
    if (files.length === 0) return json(400, { error: 'Keine PDF-Dateien übergeben' });
    if (targets.length === 0) return json(400, { error: 'Keine Requirement-Ziele übergeben' });

    const openaiKey = assertEnv('OPENAI_API_KEY');
    const model = Deno.env.get('OPENAI_MODEL') || 'gpt-5.2';
    const subjectName = asNonEmptyString(body.subjectName);
    const topicName = asNonEmptyString(body.topicName);

    const matches: Array<{
      requirementId: string;
      summary: string;
      sourceName?: string;
    }> = [];

    for (const file of files) {
      const pdfFileId = await uploadPdfToOpenAiFile({
        openaiKey,
        pdfBytes: b64ToBytes(file.fileBase64),
        pdfFilename: file.name,
      });
      const prompt = buildPrompt({ subjectName, topicName, fileName: file.name, targets });
      const openaiRes = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          max_output_tokens: 2000,
          input: [
            {
              role: 'user',
              content: [
                { type: 'input_text', text: prompt },
                { type: 'input_file', file_id: pdfFileId },
              ],
            },
          ],
        }),
      });

      if (!openaiRes.ok) {
        const text = await openaiRes.text().catch(() => '');
        return json(500, { error: text || 'OpenAI Anfrage fehlgeschlagen' });
      }

      const payload = safeJsonParse(extractAssistantText(await openaiRes.json()));
      const parsedMatches = normalizeMatches(payload?.matches, targets, file.name);
      matches.push(...parsedMatches);
    }

    return json(200, { matches });
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : 'Material-Scan fehlgeschlagen',
    });
  }
});

function buildPrompt(input: {
  subjectName?: string;
  topicName?: string;
  fileName: string;
  targets: Array<{ requirementId: string; requirementName: string; chapterName?: string; description?: string }>;
}) {
  return [
    'Extrahiere aus der PDF konkrete Lerninhalte fuer bestehende Requirements.',
    'Antworte ausschliesslich als JSON: {"matches":[{"requirementId":"...","summary":"..."}]}.',
    'Regeln:',
    '- Liefere nur Requirements, zu denen in der PDF wirklich relevante Inhalte vorkommen.',
    '- Liefere pro Requirement maximal einen Eintrag.',
    '- summary ist eine kompakte, fachlich konkrete Zusammenfassung (maximal 700 Zeichen).',
    '- requirementId muss exakt aus der Ziel-Liste stammen.',
    '- Keine Erklaerungen ausserhalb JSON.',
    input.subjectName ? `Fach: ${input.subjectName}` : '',
    input.topicName ? `Thema: ${input.topicName}` : '',
    `Datei: ${input.fileName}`,
    `Requirement-Ziele: ${JSON.stringify(input.targets)}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function normalizeFiles(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const row = (entry ?? null) as { name?: unknown; mimeType?: unknown; fileBase64?: unknown } | null;
      const name = asNonEmptyString(row?.name);
      const mimeType = asNonEmptyString(row?.mimeType) ?? 'application/pdf';
      const fileBase64 = asNonEmptyString(row?.fileBase64);
      if (!name || !fileBase64) return null;
      return { name, mimeType, fileBase64 };
    })
    .filter((row): row is { name: string; mimeType: string; fileBase64: string } => row != null);
}

function normalizeTargets(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const row = (entry ?? null) as {
        requirementId?: unknown;
        requirementName?: unknown;
        chapterName?: unknown;
        description?: unknown;
      } | null;
      const requirementId = asNonEmptyString(row?.requirementId);
      const requirementName = asNonEmptyString(row?.requirementName);
      if (!requirementId || !requirementName) return null;
      return {
        requirementId,
        requirementName,
        chapterName: asNonEmptyString(row?.chapterName),
        description: asNonEmptyString(row?.description),
      };
    })
    .filter(
      (
        row,
      ): row is {
        requirementId: string;
        requirementName: string;
        chapterName?: string;
        description?: string;
      } => row != null,
    );
}

function normalizeMatches(
  value: unknown,
  targets: Array<{ requirementId: string }>,
  sourceName: string,
) {
  if (!Array.isArray(value)) return [];
  const validIds = new Set(targets.map((target) => target.requirementId));
  const seenRequirementIds = new Set<string>();
  return value
    .map((entry) => {
      const row = (entry ?? null) as { summary?: unknown; requirementId?: unknown } | null;
      const summary = asNonEmptyString(row?.summary);
      const requirementId = asNonEmptyString(row?.requirementId);
      if (!summary || !requirementId || !validIds.has(requirementId)) return null;
      if (seenRequirementIds.has(requirementId)) return null;
      seenRequirementIds.add(requirementId);
      return {
        requirementId,
        summary,
        sourceName,
      };
    })
    .filter(
      (
        row,
      ): row is {
        requirementId: string;
        summary: string;
        sourceName: string;
      } => row != null,
    );
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
    new Blob([args.pdfBytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' }),
    args.pdfFilename || 'material.pdf',
  );
  const res = await fetch('https://api.openai.com/v1/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${args.openaiKey}` },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenAI file upload fehlgeschlagen (${res.status}): ${text}`);
  }
  const payload = (await res.json()) as { id?: unknown };
  if (typeof payload.id !== 'string' || !payload.id) throw new Error('OpenAI file id fehlt');
  return payload.id;
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
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(cleaned) as { snippets?: unknown };
  } catch {
    return null;
  }
}

function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
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
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
