declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
};
// @ts-expect-error Deno remote import
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

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
  // deno-lint-ignore no-console
  console.log(JSON.stringify({ reqId, msg, ...(extra ?? {}) }));
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function assertEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
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
    args.pdfFilename || 'curriculum.pdf',
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

function safeJsonParse(text: string) {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned) as { topics?: unknown };
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as { topics?: unknown };
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeCurriculum(input: unknown) {
  const root = (input ?? null) as Record<string, unknown> | null;
  const topics = Array.isArray(root?.topics) ? root.topics : [];

  return {
    topics: topics
      .map((topic) => {
        const topicRow = (topic ?? null) as Record<string, unknown> | null;
        if (!topicRow || typeof topicRow.name !== 'string' || !topicRow.name.trim()) return null;
        const chapters = Array.isArray(topicRow.chapters) ? topicRow.chapters : [];
        return {
          name: topicRow.name.trim(),
          iconEmoji:
            typeof topicRow.iconEmoji === 'string' && topicRow.iconEmoji.trim()
              ? topicRow.iconEmoji.trim()
              : undefined,
          chapters: chapters
            .map((chapter) => {
              const chapterRow = (chapter ?? null) as Record<string, unknown> | null;
              if (!chapterRow || typeof chapterRow.name !== 'string' || !chapterRow.name.trim())
                return null;
              const requirements = Array.isArray(chapterRow.requirements)
                ? chapterRow.requirements
                : [];
              return {
                name: chapterRow.name.trim(),
                description:
                  typeof chapterRow.description === 'string' && chapterRow.description.trim()
                    ? chapterRow.description.trim()
                    : undefined,
                requirements: requirements
                  .map((requirement) => {
                    const requirementRow = (requirement ?? null) as Record<string, unknown> | null;
                    if (
                      !requirementRow ||
                      typeof requirementRow.name !== 'string' ||
                      !requirementRow.name.trim()
                    ) {
                      return null;
                    }
                    const difficultyValue =
                      typeof requirementRow.difficulty === 'number'
                        ? requirementRow.difficulty
                        : Number(requirementRow.difficulty);
                    return {
                      name: requirementRow.name.trim(),
                      description:
                        typeof requirementRow.description === 'string' &&
                        requirementRow.description.trim()
                          ? requirementRow.description.trim()
                          : undefined,
                      difficulty:
                        Number.isFinite(difficultyValue) &&
                        difficultyValue >= 1 &&
                        difficultyValue <= 5
                          ? Math.round(difficultyValue)
                          : 3,
                    };
                  })
                  .filter(Boolean),
              };
            })
            .filter(Boolean),
        };
      })
      .filter(Boolean),
  };
}

serve(async (req) => {
  const reqId = newReqId();
  const startedAt = Date.now();
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

    const body = (await req.json()) as {
      subjectName?: string;
      filename?: string;
      mimeType?: string;
      fileBase64?: string;
      desiredTopicNames?: unknown;
    };
    if (!body.subjectName || !body.fileBase64) {
      return json(400, { error: 'subjectName oder fileBase64 fehlt' });
    }

    const desiredTopicNames = Array.isArray(body.desiredTopicNames)
      ? body.desiredTopicNames
          .filter((x) => typeof x === 'string')
          .map((x) => x.trim())
          .filter(Boolean)
      : undefined;

    const openaiKey = assertEnv('OPENAI_API_KEY');
    const model =
      Deno.env.get('OPENAI_CURRICULUM_MODEL') || Deno.env.get('OPENAI_MODEL') || 'gpt-5.4';
    const pdfFilename =
      typeof body.filename === 'string' && body.filename ? body.filename : 'curriculum.pdf';
    const pdfBytes = b64ToBytes(body.fileBase64);

    log(reqId, 'request_received', {
      subjectName: safeSnippet(body.subjectName, 120),
      filename: pdfFilename,
      mimeType: body.mimeType || 'application/pdf',
      fileBytes: pdfBytes.byteLength,
      desiredTopicNamesCount: desiredTopicNames?.length ?? 0,
    });

    const pdfFileId = await uploadPdfToOpenAiFile({
      reqId,
      openaiKey,
      pdfBytes,
      pdfFilename,
    });

    const prompt = [
      'Extrahiere aus dem Lehrplan eine kompakte Fachstruktur fuer eine Lern-App.',
      'Antworte nur als JSON ohne Markdown oder Erklaertext.',
      'Schema:',
      '{ "topics": [{ "name": string, "iconEmoji"?: string, "chapters": [{ "name": string, "description"?: string, "requirements": [{ "name": string, "description"?: string, "difficulty": 1|2|3|4|5 }] }] }] }',
      'Regeln:',
      `- Fach: ${body.subjectName}`,
      '- Bilde nur sinnvolle, abiturrelevante Topics.',
      '- Jedes Requirement ist eine atomare Fähigkeit.',
      '- Formuliere kompakt: kurze Namen, Kapitelbeschreibung hoechstens ein kurzer Satz, Requirement-Beschreibung nur wenn wirklich noetig.',
      '- Keine Dopplungen, kein Fliesstext, keine Erklaerung ausserhalb des JSON.',
      '- Wenn Informationen fehlen, liefere trotzdem die beste strukturierte Schätzung aus dem Dokument.',
    ].join('\n');

    const desiredTopicsPrompt = desiredTopicNames?.length
      ? [
          'Zusatzregeln (Wunschliste):',
          '- Wenn Gewuenschte Topics angegeben sind, erzeuge genau diese Topics in der gleichen Reihenfolge.',
          '- Erzeuge keine zusaetzlichen Topics.',
          '- Jeder Gewuenschte Topic-Name darf leicht angepasst werden, muss aber dem Gewuenschten eindeutig entsprechen.',
          '- Fuer jeden Gewuenschten Topic: verwende nur Kapitel/Requirements aus dem Dokument, die dazu passen.',
          `- Gewuenschte Topics: ${desiredTopicNames.join(' | ')}`,
        ].join('\n')
      : '';

    const finalPrompt = desiredTopicsPrompt ? `${prompt}\n${desiredTopicsPrompt}` : prompt;

    log(reqId, 'openai_request_start', {
      model,
      hasFileId: Boolean(pdfFileId),
    });

    const openaiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        reasoning: { effort: 'medium' },
        max_output_tokens: 6000,
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text: 'Du strukturierst deutsche Abitur-Lehrplaene fuer eine Lern-App. Antworte strikt im geforderten JSON-Schema.',
              },
            ],
          },
          {
            role: 'user',
            content: [
              { type: 'input_text', text: finalPrompt },
              { type: 'input_file', file_id: pdfFileId },
            ],
          },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const t = await openaiRes.text();
      log(reqId, 'openai_request_failed', {
        status: openaiRes.status,
        bodySnippet: safeSnippet(t, 800),
      });
      return json(500, { error: `OpenAI error: ${openaiRes.status} ${t}` });
    }

    const openaiJson = await openaiRes.json();
    const assistantText = extractAssistantText(openaiJson);
    const parsed = safeJsonParse(assistantText);
    const normalized = normalizeCurriculum(parsed);
    if (!parsed || !Array.isArray(normalized.topics) || normalized.topics.length === 0) {
      log(reqId, 'json_parse_failed', {
        assistantSnippet: safeSnippet(assistantText, 1200),
      });
      return json(500, {
        error: 'Curriculum konnte nicht als JSON gelesen werden',
      });
    }

    log(reqId, 'request_ok', {
      topicsCount: normalized.topics.length,
      ms: Date.now() - startedAt,
    });
    const filterTopicsByDesiredNames = (input: {
      topics: typeof normalized.topics;
      desiredNames: string[];
    }) => {
      const stripDiacritics = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
      const normalizeForMatch = (s: string) =>
        stripDiacritics(s.toLowerCase().trim())
          .replace(/ß/g, 'ss')
          .replace(/[^a-z0-9]+/g, ' ')
          .trim();

      const tokenOverlapScore = (desiredNorm: string, topicNorm: string) => {
        if (!desiredNorm || !topicNorm) return 0;
        if (desiredNorm === topicNorm) return 1;
        if (topicNorm.includes(desiredNorm) || desiredNorm.includes(topicNorm)) return 0.85;
        const dTokens = desiredNorm.split(' ').filter(Boolean);
        const tTokens = topicNorm.split(' ').filter(Boolean);
        const tSet = new Set(tTokens);
        let inter = 0;
        for (const tok of dTokens) if (tSet.has(tok)) inter += 1;
        const denom = Math.max(1, Math.max(dTokens.length, tTokens.length));
        return inter / denom;
      };

      const desiredNormalizedTokens = input.desiredNames.map((n) => normalizeForMatch(n));
      const usedTopicIdx = new Set<number>();
      const selected: typeof input.topics = [];

      for (let i = 0; i < input.desiredNames.length; i++) {
        const desiredRaw = input.desiredNames[i];
        const desiredNorm = desiredNormalizedTokens[i];
        const desiredTokenCount = desiredNorm ? desiredNorm.split(' ').filter(Boolean).length : 0;

        // Je weniger Tokens, desto empfindlicher auf exakte/substring Aehnlichkeit.
        const threshold = desiredTokenCount <= 2 ? 0.22 : 0.3;

        let bestIdx = -1;
        let bestScore = -1;
        for (let j = 0; j < input.topics.length; j++) {
          if (usedTopicIdx.has(j)) continue;
          const topicNorm = normalizeForMatch(input.topics[j]?.name ?? '');
          const score = tokenOverlapScore(desiredNorm, topicNorm);
          if (score > bestScore) {
            bestScore = score;
            bestIdx = j;
          }
        }

        if (bestIdx >= 0 && bestScore >= threshold) {
          usedTopicIdx.add(bestIdx);
          selected.push(input.topics[bestIdx]);
        } else {
          log(reqId, 'desired_topic_no_match', {
            desired: desiredRaw,
            desiredNorm,
            bestIdx,
            bestScore,
          });
        }
      }

      return selected;
    };

    if (desiredTopicNames?.length) {
      const selected = filterTopicsByDesiredNames({ topics: normalized.topics, desiredNames: desiredTopicNames });
      if (selected.length > 0) {
        log(reqId, 'topics_filtered_by_desired_list', {
          desiredCount: desiredTopicNames.length,
          selectedCount: selected.length,
        });
        return json(200, { topics: selected });
      }
    }

    return json(200, { topics: normalized.topics });
  } catch (error) {
    log(reqId, 'request_exception', {
      ms: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    return json(500, { error: error instanceof Error ? error.message : 'Unknown error' });
  }
});
