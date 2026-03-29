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

const STEP_TYPES = ['explain', 'check', 'exercise', 'review', 'complete'] as const;
const EXERCISE_TYPES = ['single_choice', 'matching', 'free_text'] as const;
const MESSAGE_KINDS = [
  'plan',
  'explanation',
  'question',
  'exercise',
  'feedback',
  'completion',
] as const;
const INPUT_MODES = ['none', 'text', 'single_choice', 'matching', 'free_text'] as const;

type StepType = (typeof STEP_TYPES)[number];
type ExerciseType = (typeof EXERCISE_TYPES)[number];
type MessageKind = (typeof MESSAGE_KINDS)[number];
type InputMode = (typeof INPUT_MODES)[number];

type UserResponse =
  | { kind: 'text' | 'free_text'; text: string }
  | { kind: 'single_choice'; selectedOptionId: string }
  | { kind: 'matching'; pairs: { leftId: string; rightId: string }[] };

type RequirementPlanStep = {
  id: string;
  title: string;
  type: StepType;
  exerciseType?: ExerciseType;
  description?: string;
};

type RequirementPlan = {
  id: string;
  steps: RequirementPlanStep[];
};

type HistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
  stepId?: string;
  stepType?: StepType;
  messageKind?: MessageKind;
  response?: UserResponse;
};

type ReqBody = {
  mode?: unknown;
  learningMode?: unknown;
  requirementGoal?: unknown;
  history?: unknown;
  chapterContext?: unknown;
  plan?: unknown;
  currentStepId?: unknown;
};

serve(async (req) => {
  const reqId = newReqId();
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

    const body = (await req.json()) as ReqBody;
    const mode = body.mode === 'turn' ? 'turn' : 'plan';
    const learningMode = body.learningMode === 'review' ? 'review' : 'learn';
    const requirementGoal =
      typeof body.requirementGoal === 'string' ? body.requirementGoal.trim() : '';
    if (!requirementGoal) return json(400, { error: 'requirementGoal fehlt' });

    const history = normalizeHistory(body.history);
    const chapterContext = normalizeChapterContext(body.chapterContext);
    const plan = normalizePlan(body.plan);
    const currentStepId =
      typeof body.currentStepId === 'string' && body.currentStepId.trim()
        ? body.currentStepId.trim()
        : undefined;
    const currentStep =
      plan && currentStepId ? plan.steps.find((step) => step.id === currentStepId) ?? null : null;

    if (mode === 'turn' && (!plan || !currentStep)) {
      return json(400, { error: 'turn mode braucht plan und currentStepId' });
    }

    const apiKey = assertEnv('OPENAI_API_KEY');
    const model = Deno.env.get('OPENAI_MODEL') || 'gpt-5.2';
    const prompt = buildPrompt({
      mode,
      learningMode,
      requirementGoal,
      chapterContext,
      history,
      plan,
      currentStepId,
      currentStep,
    });

    log(reqId, 'openai_request_start', {
      mode,
      learningMode,
      model,
      currentStepId,
      promptChars: prompt.length,
      historyCount: history.length,
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
          max_output_tokens: 900,
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

        if (attempt === 0 && (openaiStatus === 429 || openaiStatus >= 500)) {
          await sleep(500 + attempt * 500);
          continue;
        }

        return json(200, {
          message:
            openaiStatus === 429
              ? 'Ich bin gerade kurz an einem Rate-Limit gescheitert. Bitte sende deine letzte Antwort gleich nochmal.'
              : 'Ich hatte kurz technische Probleme, deine Lernerunde fortzusetzen. Bitte versuche es gleich nochmal.',
          message_kind: 'feedback',
          expects_input: 'text',
          await_user_reply: true,
          complete_requirement: false,
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
          'Ich konnte meine letzte Antwort leider nicht sauber als Lernschritt einordnen. Antworte bitte nochmal kurz auf die letzte Frage.',
        message_kind: 'feedback',
        expects_input: 'text',
        await_user_reply: true,
        complete_requirement: false,
      });
    }

    const responsePlan = normalizePlan(parsed.plan) ?? plan;
    const message = asNonEmptyString(parsed.message);
    if (!message) {
      return json(200, {
        message: 'Es ist ein kleines Formatproblem aufgetreten. Bitte antworte nochmal kurz auf die letzte Frage.',
        message_kind: 'feedback',
        expects_input: 'text',
        await_user_reply: true,
        complete_requirement: false,
      });
    }

    const returnedStepId =
      asNonEmptyString(parsed.current_step_id) ?? currentStepId ?? responsePlan?.steps[0]?.id;
    const messageKind = isMessageKind(parsed.message_kind)
      ? (parsed.message_kind as MessageKind)
      : 'explanation';
    const expectsInput = isInputMode(parsed.expects_input)
      ? (parsed.expects_input as InputMode)
      : 'none';
    const exercise = normalizeExercise(parsed.exercise);
    const completeRequirement = parsed.complete_requirement === true;
    const masteryDelta = completeRequirement
      ? clampMasteryDelta(
          typeof parsed.mastery_delta === 'number' && Number.isFinite(parsed.mastery_delta)
            ? parsed.mastery_delta
            : 0.12,
        )
      : undefined;

    return json(200, {
      plan: responsePlan,
      current_step_id: returnedStepId,
      message,
      message_kind: messageKind,
      expects_input: expectsInput,
      exercise,
      await_user_reply: parsed.await_user_reply === true,
      complete_requirement: completeRequirement,
      mastery_delta: masteryDelta,
    });
  } catch {
    log(newReqId(), 'unexpected_error', {});
    return json(200, {
      message:
        'Es gab einen unerwarteten technischen Fehler beim Wissenspfad. Bitte versuche es erneut oder sende deine letzte Antwort nochmal.',
      message_kind: 'feedback',
      expects_input: 'text',
      await_user_reply: true,
      complete_requirement: false,
    });
  }
});

function buildPrompt(input: {
  mode: 'plan' | 'turn';
  learningMode: 'learn' | 'review';
  requirementGoal: string;
  chapterContext: ReturnType<typeof normalizeChapterContext>;
  history: HistoryMessage[];
  plan: RequirementPlan | null;
  currentStepId?: string;
  currentStep: RequirementPlanStep | null;
}) {
  const base = [
    'Du steuerst den Wissenspfad einer Abi-Lern-App fuer lehrplanbasiertes Lernen.',
    'Antworte NUR als JSON mit genau diesem Schema:',
    '{ "plan"?: { "id": string, "steps": [{ "id": string, "title": string, "type": "explain"|"check"|"exercise"|"review"|"complete", "exerciseType"?: "single_choice"|"matching"|"free_text", "description"?: string }] }, "current_step_id"?: string, "message": string, "message_kind": "plan"|"explanation"|"question"|"exercise"|"feedback"|"completion", "expects_input": "none"|"text"|"single_choice"|"matching"|"free_text", "exercise"?: object, "await_user_reply"?: boolean, "complete_requirement"?: boolean, "mastery_delta"?: number }',
    '',
    'Allgemeine Regeln:',
    '- Schreibe auf Deutsch, klar, freundlich, substanziell und lernorientiert.',
    '- Vermeide generische Meta-Rueckfragen wie "Soll ich tiefer gehen?", "Ist das nachvollziehbar?" oder "Soll ich noch ein Beispiel geben?".',
    '- Wenn du fachlich etwas erklaerst, endet die Nachricht mit genau EINER kurzen Verstaendnisfrage, die sich direkt auf den gerade erklaerten Inhalt bezieht.',
    '- Die Verstaendnisfrage soll kurz sein und eher an den erklaerten Inhalt anschliessen als neue Themen aufmachen.',
    '- Wechsle Schritt oder Interaktionsform, sobald es didaktisch sinnvoll ist. Bleibe nicht kuenstlich zu lange im selben Schritt.',
    '- Uebungen duerfen nur die Typen single_choice, matching oder free_text verwenden.',
    '- Bei exercise-Schritten setze expects_input passend zum exercise type und liefere ein exercise-Objekt.',
    '- Wenn du auf eine Nutzerantwort wartest, setze await_user_reply=true.',
    '- mastery_delta darf nur gesetzt werden, wenn complete_requirement=true.',
    '- Keine Markdown-Tabellen, kein JSON ausserhalb des geforderten Schemas.',
    '',
    `Requirement-Ziel: ${input.requirementGoal}`,
    `Lernmodus: ${input.learningMode}`,
    `Kapitelkontext: ${JSON.stringify(input.chapterContext)}`,
    `Bisheriger Verlauf: ${safeSnippet(JSON.stringify(input.history), 3200)}`,
  ];

  if (input.mode === 'plan') {
    return [
      ...base,
      '',
      'Planungsmodus:',
      '- Erzeuge einen plausiblen Requirement-Plan mit 4 bis 7 Schritten.',
      '- Der erste Schritt MUSS type="explain" haben.',
      '- Der letzte Schritt MUSS type="complete" haben.',
      '- Der Plan soll mindestens einen exercise-Schritt enthalten.',
      '- Nutze exerciseType nur bei exercise-Schritten.',
      '- Gib bereits die erste fachliche Erklaerung fuer den ersten Schritt.',
      '- Diese erste Nachricht endet mit genau einer kurzen Verstaendnisfrage zum eben erklaerten Inhalt.',
      '- Setze current_step_id auf den ersten Schritt.',
      '- Im Lernmodus soll der Plan neue Inhalte schrittweise aufbauen.',
      '- Im Wiederholmodus soll der Plan kuerzer, recall-orientierter und uebungsnäher sein.',
      '- Setze message_kind="explanation", expects_input="text", await_user_reply=true und complete_requirement=false.',
    ].join('\n');
  }

  return [
    ...base,
    '',
    `Aktueller Plan: ${safeSnippet(JSON.stringify(input.plan), 2500)}`,
    `Aktuelle Schritt-ID: ${JSON.stringify(input.currentStepId ?? null)}`,
    `Aktueller Schritt: ${JSON.stringify(input.currentStep)}`,
    '',
    'Turn-Modus:',
    '- Arbeite immer entlang des bestehenden Plans.',
    '- Im Lernmodus darfst du zuerst kurz erklaeren und dann abfragen.',
    '- Im Wiederholmodus sollst du knapper sein, frueher in Fragen/Uebungen wechseln und eher abrufen als neu aufbauen.',
    '- Wenn die letzte Nutzerantwort fuer den aktuellen Schritt ausreichend ist, gehe zuegig zum naechsten sinnvollen Schritt weiter.',
    '- Wenn sie nicht ausreicht, bleibe im aktuellen Schritt und gib gezieltes, kurzes Feedback.',
    '- Bei explain/check/review: erklaere oder reagiere knapp und ende mit genau einer kurzen Verstaendnisfrage. Setze expects_input="text" und await_user_reply=true.',
    '- Bei exercise: wenn fuer den aktuellen Schritt noch keine Nutzerantwort vorliegt, liefere SOFORT die eigentliche Uebung als exercise-Objekt.',
    '- Frage vor einer Uebung NICHT, ob der Nutzer bereit ist, und stelle keine Meta-Zwischenfrage vor dem exercise-Objekt.',
    '- Wenn expects_input auf single_choice, matching oder free_text steht, MUSS im selben Turn auch ein passendes exercise-Objekt geliefert werden.',
    '- Wenn bereits eine Antwort auf die Uebung vorliegt, bewerte sie knapp und gehe dann weiter oder lasse gezielt wiederholen.',
    '- Bei single_choice liefere 3 bis 5 Optionen.',
    '- Bei matching liefere 3 bis 5 linke und rechte Eintraege.',
    '- Bei free_text liefere eine klare, kurze Aufgabenstellung und optional placeholder.',
    '- Wenn du in den complete-Schritt wechselst, gib eine kurze Abschlussnachricht und setze complete_requirement=true, expects_input="none", await_user_reply=false und mastery_delta auf 0.08 bis 0.15.',
  ].join('\n');
}

function normalizeHistory(input: unknown): HistoryMessage[] {
  if (!Array.isArray(input)) return [];
  const out: HistoryMessage[] = [];
  for (const entry of input) {
    const row = (entry ?? null) as Record<string, unknown> | null;
    if (!row) continue;
    const role = row.role;
    const content = typeof row.content === 'string' ? row.content.trim() : '';
    if ((role === 'user' || role === 'assistant') && content) {
      out.push({
        role,
        content: safeSnippet(content, 420),
        stepId: asNonEmptyString(row.stepId),
        stepType: isStepType(row.stepType) ? row.stepType : undefined,
        messageKind: isMessageKind(row.messageKind) ? row.messageKind : undefined,
        response: normalizeUserResponse(row.response),
      });
    }
  }
  return out.slice(-12);
}

function normalizePlan(input: unknown): RequirementPlan | null {
  const row = (input ?? null) as Record<string, unknown> | null;
  if (!row || typeof row.id !== 'string' || !Array.isArray(row.steps)) return null;

  const steps = row.steps
    .map((step) => normalizePlanStep(step))
    .filter((step): step is RequirementPlanStep => step != null);
  if (steps.length === 0) return null;

  return { id: row.id, steps };
}

function normalizePlanStep(input: unknown): RequirementPlanStep | null {
  const row = (input ?? null) as Record<string, unknown> | null;
  if (!row) return null;
  const id = asNonEmptyString(row.id);
  const title = asNonEmptyString(row.title);
  if (!id || !title || !isStepType(row.type)) return null;

  return {
    id,
    title,
    type: row.type,
    exerciseType: isExerciseType(row.exerciseType) ? row.exerciseType : undefined,
    description: asNonEmptyString(row.description),
  };
}

function normalizeExercise(input: unknown) {
  const row = (input ?? null) as Record<string, unknown> | null;
  if (!row) return null;
  const prompt = asNonEmptyString(row.prompt);
  if (!prompt || !isExerciseType(row.type)) return null;

  if (row.type === 'single_choice' && Array.isArray(row.options)) {
    const options = row.options
      .map((option) => {
        const item = (option ?? null) as Record<string, unknown> | null;
        const id = asNonEmptyString(item?.id);
        const text = asNonEmptyString(item?.text);
        return id && text ? { id, text } : null;
      })
      .filter((option): option is { id: string; text: string } => option != null);
    if (options.length >= 2) return { type: row.type, prompt, options };
  }

  if (row.type === 'matching' && Array.isArray(row.leftItems) && Array.isArray(row.rightItems)) {
    const leftItems = row.leftItems
      .map((item) => {
        const entry = (item ?? null) as Record<string, unknown> | null;
        const id = asNonEmptyString(entry?.id);
        const text = asNonEmptyString(entry?.text);
        return id && text ? { id, text } : null;
      })
      .filter((item): item is { id: string; text: string } => item != null);
    const rightItems = row.rightItems
      .map((item) => {
        const entry = (item ?? null) as Record<string, unknown> | null;
        const id = asNonEmptyString(entry?.id);
        const text = asNonEmptyString(entry?.text);
        return id && text ? { id, text } : null;
      })
      .filter((item): item is { id: string; text: string } => item != null);
    if (leftItems.length >= 2 && rightItems.length >= 2) {
      return { type: row.type, prompt, leftItems, rightItems };
    }
  }

  if (row.type === 'free_text') {
    return {
      type: row.type,
      prompt,
      placeholder: asNonEmptyString(row.placeholder),
    };
  }

  return null;
}

function normalizeUserResponse(input: unknown): UserResponse | undefined {
  const row = (input ?? null) as Record<string, unknown> | null;
  if (!row || typeof row.kind !== 'string') return undefined;

  if ((row.kind === 'text' || row.kind === 'free_text') && typeof row.text === 'string') {
    return { kind: row.kind, text: safeSnippet(row.text, 320) };
  }

  if (row.kind === 'single_choice' && typeof row.selectedOptionId === 'string') {
    return { kind: row.kind, selectedOptionId: row.selectedOptionId };
  }

  if (row.kind === 'matching' && Array.isArray(row.pairs)) {
    const pairs = row.pairs
      .map((pair) => {
        const entry = (pair ?? null) as Record<string, unknown> | null;
        const leftId = asNonEmptyString(entry?.leftId);
        const rightId = asNonEmptyString(entry?.rightId);
        return leftId && rightId ? { leftId, rightId } : null;
      })
      .filter((pair): pair is { leftId: string; rightId: string } => pair != null);
    return { kind: row.kind, pairs };
  }

  return undefined;
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

function isStepType(value: unknown): value is StepType {
  return typeof value === 'string' && STEP_TYPES.includes(value as StepType);
}

function isExerciseType(value: unknown): value is ExerciseType {
  return typeof value === 'string' && EXERCISE_TYPES.includes(value as ExerciseType);
}

function isMessageKind(value: unknown): value is MessageKind {
  return typeof value === 'string' && MESSAGE_KINDS.includes(value as MessageKind);
}

function isInputMode(value: unknown): value is InputMode {
  return typeof value === 'string' && INPUT_MODES.includes(value as InputMode);
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

function safeSnippet(s: string, maxLen = 500) {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length <= maxLen ? t : `${t.slice(0, maxLen)}…`;
}

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

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
