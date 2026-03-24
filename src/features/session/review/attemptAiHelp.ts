export const ATTEMPT_AI_HELP_NOTE = 'StudyAI-Hilfe genutzt.';

export function hasAttemptUsedAiHelp(note?: string | null) {
  return normalizeNote(note)?.includes(ATTEMPT_AI_HELP_NOTE) ?? false;
}

export function appendAttemptAiHelpNote(note?: string | null) {
  const normalized = normalizeNote(note);
  if (!normalized) return ATTEMPT_AI_HELP_NOTE;
  if (hasAttemptUsedAiHelp(normalized)) return normalized;
  return `${normalized}\n${ATTEMPT_AI_HELP_NOTE}`;
}

export function mergeAttemptNotes(baseNote?: string | null, extraNote?: string | null) {
  const normalizedBase = normalizeNote(baseNote);
  const normalizedExtra = normalizeNote(extraNote);

  if (!normalizedBase) return normalizedExtra;
  if (!normalizedExtra) return normalizedBase;
  if (normalizedBase === normalizedExtra || normalizedBase.includes(normalizedExtra)) {
    return normalizedBase;
  }
  return `${normalizedBase}\n${normalizedExtra}`;
}

function normalizeNote(note?: string | null) {
  const trimmed = note?.trim();
  return trimmed ? trimmed : undefined;
}
