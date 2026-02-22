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
  if (!pdfBytes) throw new Error('PDF fehlt (pdfData ist leer).');
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

  // For now: always attach the PDF to every request (no storage caching).
  if (input.docId) body.docId = input.docId;
  body.pdfBase64 = pdfBytesToBase64(pdfBytes);
  body.pdfFilename = 'exercise.pdf';
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
