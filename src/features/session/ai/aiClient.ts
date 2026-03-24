import type { Chapter, Requirement } from '../../../domain/models';
import { pdfBytesSha256Hex, pdfBytesToBase64 } from '../../../ink/attemptComposite';
import { getSupabaseClient } from '../../../lib/supabaseClient';
import { openAiPdfFileCacheRepo } from '../../../repositories';
import type { StudyAiMessage } from '../stores/studyAiChatStore';
import type { ReviewSummaryRequest, ReviewSummaryResponse } from './reviewSummaryTypes';

const MAX_PDF_BYTES = 12 * 1024 * 1024;
const MAX_ATTEMPT_IMAGE_CHARS = 6_000_000;

export async function sendStudyAiMessage(input: {
  conversationKey: string;
  messages: StudyAiMessage[];
  docId: string | null;
  pdfData: Uint8Array | null;
  attemptImageDataUrl: string | null;
  requireAttemptImage?: boolean;
}): Promise<{ docId: string; assistantMessage: string }> {
  const supabase = getSupabaseClient();
  const pdfBytes = input.pdfData;
  if (input.attemptImageDataUrl && input.attemptImageDataUrl.length > MAX_ATTEMPT_IMAGE_CHARS) {
    throw new Error('Attempt-Bild ist zu groß.');
  }

  const reusableOpenAiFileId = await resolveReusableOpenAiFileId({
    docId: input.docId,
    pdfData: pdfBytes,
  });

  if (!pdfBytes && !reusableOpenAiFileId) throw new Error('PDF fehlt (pdfData ist leer).');
  if (!reusableOpenAiFileId && pdfBytes && pdfBytes.byteLength > MAX_PDF_BYTES) {
    throw new Error('PDF ist zu groß.');
  }

  const pdfSha256 = pdfBytes ? await pdfBytesSha256Hex(pdfBytes) : null;

  const body: {
    conversationKey: string;
    openAiFileId?: string;
    pdfBase64?: string;
    pdfFilename?: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    attemptImageDataUrl?: string;
    requireAttemptImage?: boolean;
  } = {
    conversationKey: input.conversationKey,
    messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
  };

  if (reusableOpenAiFileId) body.openAiFileId = reusableOpenAiFileId;
  if (!reusableOpenAiFileId && pdfBytes) {
    body.pdfBase64 = pdfBytesToBase64(pdfBytes);
    body.pdfFilename = 'exercise.pdf';
  }
  if (input.attemptImageDataUrl) body.attemptImageDataUrl = input.attemptImageDataUrl;
  if (input.requireAttemptImage) body.requireAttemptImage = true;

  let data: unknown;
  try {
    data = await invokeStudyAiFunction(supabase, body);
  } catch (error) {
    if (
      reusableOpenAiFileId &&
      pdfBytes &&
      isMissingOpenAiFileError(error) &&
      pdfSha256
    ) {
      await openAiPdfFileCacheRepo.delete(pdfSha256);
      delete body.openAiFileId;
      body.pdfBase64 = pdfBytesToBase64(pdfBytes);
      body.pdfFilename = 'exercise.pdf';
      data = await invokeStudyAiFunction(supabase, body);
    } else {
      throw error;
    }
  }
  if (!data || typeof data !== 'object') throw new Error('Ungültige Antwort vom Server');

  const d = data as {
    docId?: unknown;
    openAiFileId?: unknown;
    assistantMessage?: unknown;
    error?: unknown;
  };
  if (typeof d.error === 'string' && d.error) throw new Error(d.error);
  const resolvedOpenAiFileId =
    typeof d.openAiFileId === 'string' && d.openAiFileId
      ? d.openAiFileId
      : typeof d.docId === 'string' && d.docId
      ? d.docId
      : null;
  if (!resolvedOpenAiFileId) throw new Error('openAiFileId fehlt in Antwort');
  if (typeof d.assistantMessage !== 'string') throw new Error('assistantMessage fehlt in Antwort');

  if (pdfSha256) {
    await openAiPdfFileCacheRepo.upsert({
      pdfSha256,
      openAiFileId: resolvedOpenAiFileId,
      updatedAtMs: Date.now(),
    });
  }

  return { docId: resolvedOpenAiFileId, assistantMessage: d.assistantMessage };
}

async function resolveReusableOpenAiFileId(input: {
  docId: string | null;
  pdfData: Uint8Array | null;
}) {
  if (isOpenAiFileId(input.docId)) return input.docId;
  if (!input.pdfData) return null;
  const pdfSha256 = await pdfBytesSha256Hex(input.pdfData);
  return (await openAiPdfFileCacheRepo.get(pdfSha256))?.openAiFileId ?? null;
}

function isOpenAiFileId(value: string | null): value is string {
  if (!value) return false;
  if (/^[a-f0-9]{64}$/i.test(value)) return false;
  return /^file[-_]/.test(value);
}

function isMissingOpenAiFileError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /file/i.test(message) && /(not found|invalid|missing|unknown)/i.test(message);
}

async function invokeStudyAiFunction(
  supabase: ReturnType<typeof getSupabaseClient>,
  body: Record<string, unknown>,
) {
  const { data, error } = await supabase.functions.invoke('study-ai', { body });
  if (!error) return data;

  const ctx = (error as unknown as { context?: unknown } | null)?.context as
    | { response?: Response }
    | undefined;
  const resp = ctx?.response;
  if (resp) {
    try {
      const t = await resp.text();
      if (t) {
        try {
          const j = JSON.parse(t) as { error?: unknown };
          if (typeof j?.error === 'string' && j.error) throw new Error(j.error);
        } catch {
          throw new Error(t);
        }
      }
    } catch (readError) {
      if (readError instanceof Error) throw readError;
    }
  }

  throw new Error((error as { message?: string } | null)?.message || 'Edge Function Fehler');
}

export type ImportedCurriculum = {
  topics: Array<{
    name: string;
    iconEmoji?: string;
    chapters: Array<{
      name: string;
      description?: string;
      requirements: Array<{
        name: string;
        description?: string;
        difficulty: 1 | 2 | 3 | 4 | 5;
      }>;
    }>;
  }>;
};

export async function importCurriculumWithAi(input: {
  subjectName: string;
  file: File;
}): Promise<ImportedCurriculum> {
  const supabase = getSupabaseClient();
  const body = {
    subjectName: input.subjectName,
    filename: input.file.name,
    mimeType: input.file.type || 'application/pdf',
    fileBase64: uint8ArrayToBase64(new Uint8Array(await input.file.arrayBuffer())),
  };

  const { data, error } = await supabase.functions.invoke('curriculum-import', { body });
  const payload = await unwrapFunctionResponse(data, error);
  if (
    !payload ||
    typeof payload !== 'object' ||
    !Array.isArray((payload as { topics?: unknown }).topics)
  ) {
    throw new Error('Ungültige Curriculum-Antwort');
  }
  return payload as ImportedCurriculum;
}

export async function generateChapterExplanationWithAi(input: {
  subjectName: string;
  topicName: string;
  chapterName: string;
  chapterDescription?: string;
  requirements: Requirement[];
  weakRequirementNames?: string[];
}): Promise<{ title: string; markdown: string }> {
  const supabase = getSupabaseClient();
  console.log('input', input);
  const { data, error } = await supabase.functions.invoke('chapter-explanation', {
    body: {
      ...input,
      requirements: input.requirements.map((requirement) => ({
        name: requirement.name,
        description: requirement.description,
        difficulty: requirement.difficulty,
        mastery: requirement.mastery,
      })),
    },
  });
  console.log('data', data);
  console.log('error', error);
  const payload = await unwrapFunctionResponse(data, error);
  const title =
    typeof (payload as { title?: unknown })?.title === 'string'
      ? (payload as { title: string }).title
      : '';
  const markdown =
    typeof (payload as { markdown?: unknown })?.markdown === 'string'
      ? (payload as { markdown: string }).markdown
      : '';
  if (!title || !markdown) throw new Error('Kapitel-Erklärung fehlt in Antwort');
  return { title, markdown };
}

export type AttemptReviewResponse = {
  score: number;
  result: 'correct' | 'partial' | 'wrong';
  messageToUser?: string;
  notes?: string;
  errorExplanation?: string;
  solutionExplanation?: string;
  manualFallbackReason?: string;
  scheduleReview?: { dueAtMs: number };
  chapterIds: string[];
  requirements: Array<{
    requirementId?: string;
    requirementName: string;
    confidence: number;
    masteryDelta: number;
  }>;
};

export async function requestReviewSummary(input: ReviewSummaryRequest): Promise<ReviewSummaryResponse> {
  const supabase = getSupabaseClient();
  const body =
    input.scope === 'exercise'
      ? { scope: 'exercise', exercise: input.exercise }
      : { scope: 'session', session: input.session };
  const { data, error } = await supabase.functions.invoke('review-summary', { body });
  const payload = await unwrapFunctionResponse(data, error);
  if (!payload || typeof payload !== 'object') throw new Error('Ungültige Summary-Antwort');
  const p = payload as Record<string, unknown>;
  const headline = typeof p.headline === 'string' ? p.headline.trim() : '';
  const summary = typeof p.summary === 'string' ? p.summary.trim() : '';
  const tip = typeof p.tip === 'string' ? p.tip.trim() : '';
  const focusAreas = Array.isArray(p.focusAreas)
    ? p.focusAreas.filter((x): x is string => typeof x === 'string' && Boolean(x.trim()))
    : [];
  if (!summary || !tip) throw new Error('Summary-Antwort unvollständig');
  return {
    headline: headline || 'KI-Zusammenfassung',
    summary,
    tip,
    focusAreas,
  };
}

export async function requestAttemptReview(input: {
  attemptId: string;
  assetId: string;
  subjectId: string;
  topicId: string;
  problemIdx: number;
  subproblemLabel?: string;
  subsubproblemLabel?: string;
  pdfData: Uint8Array;
  attemptImageDataUrl: string;
  chapters: Chapter[];
  requirements: Requirement[];
  usedAiHelp?: boolean;
}): Promise<AttemptReviewResponse> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke('attempt-review', {
    body: {
      attemptId: input.attemptId,
      assetId: input.assetId,
      subjectId: input.subjectId,
      topicId: input.topicId,
      problemIdx: input.problemIdx,
      subproblemLabel: input.subproblemLabel,
      subsubproblemLabel: input.subsubproblemLabel,
      pdfBase64: pdfBytesToBase64(input.pdfData),
      attemptImageDataUrl: input.attemptImageDataUrl,
      usedAiHelp: input.usedAiHelp === true,
      chapters: input.chapters.map((chapter) => ({
        id: chapter.id,
        name: chapter.name,
        description: chapter.description,
      })),
      requirements: input.requirements.map((requirement) => ({
        id: requirement.id,
        chapterId: requirement.chapterId,
        name: requirement.name,
        description: requirement.description,
        difficulty: requirement.difficulty,
        mastery: requirement.mastery,
      })),
    },
  });
  const payload = await unwrapFunctionResponse(data, error);
  if (!payload || typeof payload !== 'object') throw new Error('Ungültige Review-Antwort');
  return payload as AttemptReviewResponse;
}

async function unwrapFunctionResponse(data: unknown, error: unknown) {
  if (!error) {
    const d = data as { error?: unknown } | null;
    if (typeof d?.error === 'string' && d.error) throw new Error(d.error);
    return data;
  }

  const fnError = error as { message?: string; context?: { response?: Response } } | null;
  const resp = fnError?.context?.response;
  if (resp) {
    try {
      const text = await resp.text();
      if (text) {
        try {
          const parsed = JSON.parse(text) as { error?: unknown };
          if (typeof parsed.error === 'string' && parsed.error) throw new Error(parsed.error);
        } catch {
          throw new Error(text);
        }
      }
    } catch (readError) {
      if (readError instanceof Error) throw readError;
    }
  }

  throw new Error(fnError?.message || 'Edge Function Fehler');
}

function uint8ArrayToBase64(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
