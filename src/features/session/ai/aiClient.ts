import type { Chapter, Requirement } from '../../../domain/models';
import { pdfBytesToBase64 } from '../../../ink/attemptComposite';
import { getSupabaseClient } from '../../../lib/supabaseClient';
import type { StudyAiMessage } from '../stores/studyAiChatStore';

const MAX_PDF_BYTES = 12 * 1024 * 1024;
const MAX_ATTEMPT_IMAGE_CHARS = 6_000_000;

export async function sendStudyAiMessage(input: {
  conversationKey: string;
  messages: StudyAiMessage[];
  docId: string | null;
  pdfData: Uint8Array | null;
  attemptImageDataUrl: string | null;
}): Promise<{ docId: string; assistantMessage: string }> {
  const supabase = getSupabaseClient();

  const pdfBytes = input.pdfData;
  if (!pdfBytes && !input.docId) throw new Error('PDF fehlt (pdfData ist leer).');
  if (pdfBytes && pdfBytes.byteLength > MAX_PDF_BYTES) throw new Error('PDF ist zu groß.');

  if (input.attemptImageDataUrl && input.attemptImageDataUrl.length > MAX_ATTEMPT_IMAGE_CHARS) {
    throw new Error('Attempt-Bild ist zu groß.');
  }

  const body: {
    conversationKey: string;
    docId?: string;
    pdfBase64?: string;
    pdfFilename?: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    attemptImageDataUrl?: string;
  } = {
    conversationKey: input.conversationKey,
    messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
  };

  if (input.docId) body.docId = input.docId;
  if (pdfBytes) {
    body.pdfBase64 = pdfBytesToBase64(pdfBytes);
    body.pdfFilename = 'exercise.pdf';
  }
  if (input.attemptImageDataUrl) body.attemptImageDataUrl = input.attemptImageDataUrl;

  const { data, error } = await supabase.functions.invoke('study-ai', { body });
  if (error) {
    const ctx = (error as unknown as { context?: unknown } | null)?.context as
      | { response?: Response }
      | undefined;
    const resp = ctx?.response;
    if (resp) {
      try {
        const t = await resp.text();
        try {
          const j = JSON.parse(t) as { error?: unknown };
          if (typeof j?.error === 'string' && j.error) throw new Error(j.error);
        } catch {
          // ignore json parse errors
        }
        if (t && t.trim()) throw new Error(t);
      } catch {
        // ignore response read errors
      }
    }
    throw new Error(error.message || 'Edge Function Fehler');
  }
  if (!data || typeof data !== 'object') throw new Error('Ungültige Antwort vom Server');

  const d = data as { docId?: unknown; assistantMessage?: unknown; error?: unknown };
  if (typeof d.error === 'string' && d.error) throw new Error(d.error);
  if (typeof d.docId !== 'string' || !d.docId) throw new Error('docId fehlt in Antwort');
  if (typeof d.assistantMessage !== 'string') throw new Error('assistantMessage fehlt in Antwort');

  return { docId: d.docId, assistantMessage: d.assistantMessage };
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
