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
const EXERCISE_TYPES = ['quiz', 'matching', 'free_text'] as const;
const MESSAGE_KINDS = [
  'plan',
  'explanation',
  'question',
  'exercise',
  'feedback',
  'completion',
] as const;
const INPUT_MODES = ['none', 'text', 'quiz', 'matching', 'free_text'] as const;

type StepType = (typeof STEP_TYPES)[number];
type ExerciseType = (typeof EXERCISE_TYPES)[number];
type MessageKind = (typeof MESSAGE_KINDS)[number];
type InputMode = (typeof INPUT_MODES)[number];

type UserResponse =
  | { kind: 'text' | 'free_text'; text: string }
  | { kind: 'quiz'; answers: { questionId: string; selectedOptionId: string }[] }
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
  requirementContext?: unknown;
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
    const requirementContext = normalizeRequirementContext(body.requirementContext);
    const plan = normalizePlan(body.plan);
    const currentStepId =
      typeof body.currentStepId === 'string' && body.currentStepId.trim()
        ? body.currentStepId.trim()
        : undefined;
    const currentStep =
      plan && currentStepId ? (plan.steps.find((step) => step.id === currentStepId) ?? null) : null;
    const currentStepAlreadyAnswered = hasUserResponseForStep(history, currentStepId);
    const nextStepIdAfterCurrent = getNextStepId(plan, currentStepId);

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
      requirementContext,
      history,
      plan,
      currentStepId,
      currentStep,
      currentStepAlreadyAnswered,
      nextStepIdAfterCurrent,
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
          max_output_tokens: 1200,
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
          req_id: reqId,
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
        req_id: reqId,
        message:
          'Ich konnte meine letzte Antwort leider nicht sauber als Lernschritt einordnen. Antworte bitte nochmal kurz auf die letzte Frage.',
        message_kind: 'feedback',
        expects_input: 'text',
        await_user_reply: true,
        complete_requirement: false,
      });
    }

    const responsePlan = mode === 'plan' ? normalizePlan(parsed.plan) ?? plan : plan;
    const message = asNonEmptyString(parsed.message);
    if (!message) {
      return json(200, {
        req_id: reqId,
        message:
          'Es ist ein kleines Formatproblem aufgetreten. Bitte antworte nochmal kurz auf die letzte Frage.',
        message_kind: 'feedback',
        expects_input: 'text',
        await_user_reply: true,
        complete_requirement: false,
      });
    }

    let returnedStepId =
      asNonEmptyString(parsed.current_step_id) ??
      (currentStep?.type === 'exercise' && currentStepAlreadyAnswered
        ? nextStepIdAfterCurrent
        : currentStepId) ??
      responsePlan?.steps[0]?.id;
    if (
      currentStep?.type === 'exercise' &&
      currentStepAlreadyAnswered &&
      returnedStepId === currentStepId &&
      nextStepIdAfterCurrent
    ) {
      returnedStepId = nextStepIdAfterCurrent;
    }
    const messageKind = isMessageKind(parsed.message_kind)
      ? (parsed.message_kind as MessageKind)
      : 'explanation';
    const parsedExpectsInput =
      parsed.expects_input === 'single_choice'
        ? 'quiz'
        : isInputMode(parsed.expects_input)
          ? (parsed.expects_input as InputMode)
          : 'none';
    const responseStep =
      responsePlan && returnedStepId
        ? (responsePlan.steps.find((step) => step.id === returnedStepId) ?? null)
        : currentStep;
    const shouldForceCurrentStepExerciseInput = !(
      currentStep?.type === 'exercise' &&
      currentStepAlreadyAnswered &&
      returnedStepId === currentStepId
    );
    let expectsInput = shouldForceCurrentStepExerciseInput
      ? expectedInputModeForStep(responseStep) ?? parsedExpectsInput
      : parsedExpectsInput;
    const expectedExerciseType = inferExpectedExerciseType(expectsInput, responseStep);
    let exercise = normalizeExercise(parsed.exercise);
    let exerciseStatus: 'idle' | 'loading' | 'ready' | 'missing' | 'error' = exercise ? 'ready' : 'idle';
    let degradedReason: string | undefined;
    const completeRequirement = parsed.complete_requirement === true;
    const masteryDelta = completeRequirement
      ? clampMasteryDelta(
          typeof parsed.mastery_delta === 'number' && Number.isFinite(parsed.mastery_delta)
            ? parsed.mastery_delta
            : 0.12,
        )
      : undefined;

    log(reqId, 'turn_response_pre_repair', {
      returnedStepId,
      parsedExpectsInput: parsed.expects_input,
      normalizedExpectsInput: expectsInput,
      responseStepType: responseStep?.type ?? null,
      responseStepExerciseType: responseStep?.exerciseType ?? null,
      normalizedExerciseType: exercise?.type ?? null,
      hasParsedExercise: parsed.exercise != null,
      hasNormalizedExercise: exercise != null,
      expectedExerciseType,
    });

    log(reqId, 'turn_response_interpreted', {
      returnedStepId,
      parsedExpectsInput,
      effectiveExpectsInput: expectsInput,
      responseStepType: responseStep?.type ?? null,
      responseStepExerciseType: responseStep?.exerciseType ?? null,
      rawExerciseType:
        parsed.exercise && typeof parsed.exercise === 'object' && 'type' in parsed.exercise
          ? String((parsed.exercise as Record<string, unknown>).type ?? '')
          : null,
      rawExerciseSnippet: safeSnippet(JSON.stringify(parsed.exercise ?? null), 500),
      normalizedExerciseType: exercise?.type ?? null,
      messageKind,
      awaitUserReply: parsed.await_user_reply === true,
    });

    if (isExerciseInputMode(expectsInput) && !exercise) {
      log(reqId, 'exercise_missing_repair_start', {
        returnedStepId,
        expectsInput,
        responseStepType: responseStep?.type ?? null,
        responseStepExerciseType: responseStep?.exerciseType ?? null,
      });
      const repairedExercise = await repairMissingExercise({
        apiKey,
        model,
        reqId,
        requirementGoal,
        chapterContext,
        responseStep,
        message,
        expectsInput,
      });
      if (repairedExercise) {
        exercise = repairedExercise;
        exerciseStatus = 'ready';
        log(reqId, 'turn_response_repair_succeeded', {
          returnedStepId,
          expectsInput,
          repairedExerciseType: repairedExercise.type,
        });
      } else {
        log(reqId, 'turn_response_repair_failed', {
          returnedStepId,
          expectsInput,
          fallbackExpectsInput: 'text',
        });
        exerciseStatus = 'missing';
        degradedReason = 'missing_exercise_payload';
        expectsInput = 'text';
      }
    }
    if (!isExerciseInputMode(expectsInput)) {
      exerciseStatus = 'idle';
    } else if (!exercise && exerciseStatus === 'idle') {
      exerciseStatus = 'missing';
      degradedReason = degradedReason ?? 'missing_exercise_payload';
    }

    log(reqId, 'turn_response_final', {
      returnedStepId,
      finalExpectsInput: expectsInput,
      finalExerciseType: exercise?.type ?? null,
      finalExerciseStatus: exerciseStatus,
      awaitUserReply: parsed.await_user_reply === true,
      completeRequirement,
    });

    return json(200, {
      req_id: reqId,
      plan: mode === 'plan' ? responsePlan : undefined,
      current_step_id: returnedStepId,
      message,
      message_kind: messageKind,
      expects_input: expectsInput,
      expected_exercise_type: expectedExerciseType,
      exercise_status: exerciseStatus,
      exercise,
      degraded_reason: degradedReason,
      await_user_reply: parsed.await_user_reply === true,
      complete_requirement: completeRequirement,
      mastery_delta: masteryDelta,
    });
  } catch {
    log(reqId, 'unexpected_error', {});
    return json(200, {
      req_id: reqId,
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
  requirementContext: ReturnType<typeof normalizeRequirementContext>;
  history: HistoryMessage[];
  plan: RequirementPlan | null;
  currentStepId?: string;
  currentStep: RequirementPlanStep | null;
  currentStepAlreadyAnswered: boolean;
  nextStepIdAfterCurrent: string | null;
}) {
  const base = [
    'Du steuerst den Wissenspfad einer Abi-Lern-App fuer lehrplanbasiertes Lernen.',
    'Antworte NUR als JSON mit genau diesem Schema:',
    '{ "plan"?: { "id": string, "steps": [{ "id": string, "title": string, "type": "explain"|"check"|"exercise"|"review"|"complete", "exerciseType"?: "quiz"|"matching"|"free_text", "description"?: string }] }, "current_step_id"?: string, "message": string, "message_kind": "plan"|"explanation"|"question"|"exercise"|"feedback"|"completion", "expects_input": "none"|"text"|"quiz"|"matching"|"free_text", "exercise"?: object, "await_user_reply"?: boolean, "complete_requirement"?: boolean, "mastery_delta"?: number }',
    '',
    'Allgemeine Regeln:',
    '- Schreibe auf Deutsch, klar, freundlich, substanziell und lernorientiert.',
    '- Vermeide generische Meta-Rueckfragen wie "Soll ich tiefer gehen?", "Ist das nachvollziehbar?" oder "Soll ich noch ein Beispiel geben?".',
    '- Prioritaet hat der Unterrichtsmaterial-Kontext. Erklaere, frage und uebe zuerst entlang dieser Inhalte.',
    '- Wenn du fachlich etwas erklaerst, endet die Nachricht mit genau EINER kurzen Verstaendnisfrage, die sich direkt auf den gerade erklaerten Inhalt bezieht.',
    '- Die Verstaendnisfrage soll kurz sein und eher an den erklaerten Inhalt anschliessen als neue Themen aufmachen.',
    '- Wechsle Schritt oder Interaktionsform, sobald es didaktisch sinnvoll ist. Bleibe nicht kuenstlich zu lange im selben Schritt.',
    '- Uebungen duerfen nur die Typen quiz, matching oder free_text verwenden.',
    '- Bei exercise-Schritten setze expects_input passend zum exercise type und liefere ein exercise-Objekt.',
    '- Wenn expects_input auf quiz, matching oder free_text steht, darf exercise NICHT null oder leer sein.',
    '- Wenn du auf eine Nutzerantwort wartest, setze await_user_reply=true.',
    '- mastery_delta darf nur gesetzt werden, wenn complete_requirement=true.',
    '- Keine Markdown-Tabellen, kein JSON ausserhalb des geforderten Schemas.',
    '- Wenn der Nutzer sagt, dass etwas schon erledigt wurde oder er direkt weitergehen will, pruefe den Verlauf aktiv und gehe bei ausreichender Antwort zum naechsten Schritt.',
    '- Wiederhole nicht dieselbe Rueckfrage, wenn sie im Verlauf bereits beantwortet oder korrigiert wurde.',
    '',
    `Requirement-Ziel: ${input.requirementGoal}`,
    `Lernmodus: ${input.learningMode}`,
    `Kapitelkontext: ${JSON.stringify(input.chapterContext)}`,
    `Unterrichtsmaterial-Kontext: ${safeSnippet(input.requirementContext.materialContext ?? '', 2600)}`,
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
      '- Im Planungsmodus MUSS ein plan-Objekt enthalten sein.',
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
    `Aktueller Schritt bereits beantwortet: ${input.currentStepAlreadyAnswered ? 'ja' : 'nein'}`,
    `Naechste Schritt-ID nach aktuell: ${JSON.stringify(input.nextStepIdAfterCurrent)}`,
    '',
    'Turn-Modus:',
    '- Arbeite immer entlang des bestehenden Plans.',
    '- Im Turn-Modus darfst du KEIN neues plan-Objekt schicken.',
    '- Im Lernmodus darfst du zuerst kurz erklaeren und dann abfragen.',
    '- Im Wiederholmodus sollst du knapper sein, frueher in Fragen/Uebungen wechseln und eher abrufen als neu aufbauen.',
    '- Nutze den vorhandenen Verlauf aktiv, um Fortschritt, Korrekturen und bereits gegebene Antworten zu erkennen.',
    '- Wenn die letzte Nutzerantwort fuer den aktuellen Schritt ausreichend ist, gehe zuegig zum naechsten sinnvollen Schritt weiter.',
    '- Wenn sie nicht ausreicht, bleibe im aktuellen Schritt und gib gezieltes, kurzes Feedback.',
    '- Wenn der Nutzer explizit schreibt, dass er etwas schon gemacht hat, es schon verstanden hat oder zum naechsten Schritt will, entscheide anhand des Verlaufs, ob du den Schritt direkt abschliessen kannst.',
    '- Bei explain/check/review: erklaere oder reagiere knapp und ende mit genau einer kurzen Verstaendnisfrage. Setze expects_input="text" und await_user_reply=true.',
    '- Bei exercise: wenn fuer den aktuellen Schritt noch keine Nutzerantwort vorliegt, liefere SOFORT die eigentliche Uebung als exercise-Objekt.',
    '- Wenn der aktuelle Plan-Schritt type="exercise" mit exerciseType gesetzt hat, muss expects_input exakt diesem exerciseType entsprechen.',
    '- WICHTIG: Wenn der aktuelle exercise-Schritt bereits beantwortet wurde, darfst du NICHT in diesem Schritt bleiben. Wechsle in einen neuen Schritt, setze current_step_id entsprechend und liefere KEIN weiteres exercise-Objekt fuer denselben Schritt.',
    '- Frage vor einer Uebung NICHT, ob der Nutzer bereit ist, und stelle keine Meta-Zwischenfrage vor dem exercise-Objekt.',
    '- Wenn expects_input auf quiz, matching oder free_text steht, MUSS im selben Turn auch ein passendes exercise-Objekt geliefert werden und exercise darf dann niemals null sein.',
    '- Wenn bereits eine Antwort auf die Uebung vorliegt, bewerte sie knapp und gehe danach in den naechsten sinnvollen Plan-Schritt weiter, statt dieselbe Uebung erneut zu generieren.',
    '- Bei quiz liefere einen kompletten Exercise-Block mit 2 bis 4 Fragen in exercise.questions; jede Frage hat 3 bis 5 Optionen, ein correctOptionId und optional eine kurze explanation.',
    '- Bei quiz soll jede Option ein kurzes feedback tragen (ein kurzer Satz), das direkt nach der Auswahl angezeigt werden kann.',
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
    exerciseType:
      row.exerciseType === 'single_choice'
        ? 'quiz'
        : isExerciseType(row.exerciseType)
          ? row.exerciseType
          : undefined,
    description: asNonEmptyString(row.description),
  };
}

function normalizeExercise(input: unknown) {
  const row = (input ?? null) as Record<string, unknown> | null;
  if (!row) return null;
  const rawType = asNonEmptyString(row.type)?.toLowerCase();
  const normalizedType =
    rawType === 'single_choice' ||
    rawType === 'multiple_choice' ||
    rawType === 'mcq' ||
    rawType === 'quiz_exercise'
      ? 'quiz'
      : rawType === 'free-text' || rawType === 'freetext' || rawType === 'short_answer'
        ? 'free_text'
        : rawType;
  const prompt =
    asNonEmptyString(row.prompt) ??
    asNonEmptyString(row.question) ??
    asNonEmptyString(row.task) ??
    asNonEmptyString(row.title) ??
    asNonEmptyString(row.instruction);
  if (!prompt || !normalizedType) return null;

  if (
    normalizedType === 'quiz' &&
    (Array.isArray(row.questions) ||
      Array.isArray(row.items) ||
      Array.isArray(row.quizQuestions) ||
      Array.isArray(row.aufgaben))
  ) {
    const rawQuestions = (row.questions ??
      row.items ??
      row.quizQuestions ??
      row.aufgaben ??
      []) as unknown[];
    const questions = rawQuestions
      .map((question) => {
        const item = (question ?? null) as Record<string, unknown> | null;
        const id = asNonEmptyString(item?.id);
        const questionPrompt =
          asNonEmptyString(item?.prompt) ??
          asNonEmptyString(item?.question) ??
          asNonEmptyString(item?.text) ??
          asNonEmptyString(item?.title);
        const correctOptionId =
          asNonEmptyString(item?.correctOptionId) ??
          asNonEmptyString(item?.correct_option_id) ??
          asNonEmptyString(item?.correctAnswerId) ??
          asNonEmptyString(item?.correct_answer_id) ??
          asNonEmptyString(item?.correct);
        const rawOptions = (item?.options ??
          item?.choices ??
          item?.answers ??
          item?.answerOptions) as unknown;
        if (!id || !questionPrompt || !Array.isArray(rawOptions) || !correctOptionId) return null;
        const options = rawOptions
          .map((option) => {
            const entry = (option ?? null) as Record<string, unknown> | null;
            const optionId = asNonEmptyString(entry?.id) ?? asNonEmptyString(entry?.key);
            const text =
              asNonEmptyString(entry?.text) ??
              asNonEmptyString(entry?.label) ??
              asNonEmptyString(entry?.content) ??
              asNonEmptyString(entry?.value);
            const feedback =
              asNonEmptyString(entry?.feedback) ??
              asNonEmptyString(entry?.reason) ??
              asNonEmptyString(entry?.rationale) ??
              asNonEmptyString(entry?.hint);
            if (!optionId || !text) return null;
            return feedback ? { id: optionId, text, feedback } : { id: optionId, text };
          })
          .filter((option): option is { id: string; text: string; feedback?: string } => option != null);
        const hasCorrectOption = options.some((option) => option.id === correctOptionId);
        return options.length >= 2 && hasCorrectOption
          ? {
              id,
              prompt: questionPrompt,
              options,
              correctOptionId,
              ...(asNonEmptyString(item?.explanation)
                ? { explanation: asNonEmptyString(item?.explanation) }
                : {}),
            }
          : null;
      })
      .filter(
        (
          question,
        ): question is {
          id: string;
          prompt: string;
          options: { id: string; text: string; feedback?: string }[];
          correctOptionId: string;
          explanation?: string;
        } => question != null,
      );
    if (questions.length >= 1) return { type: 'quiz', prompt, questions };
  }

  if (normalizedType === 'quiz' && Array.isArray(row.options)) {
    const correctOptionId =
      asNonEmptyString(row.correctOptionId) ??
      asNonEmptyString(row.correct_option_id) ??
      asNonEmptyString(row.correctAnswerId) ??
      asNonEmptyString(row.correct_answer_id) ??
      asNonEmptyString(row.correct);
    const options = row.options
      .map((option) => {
        const item = (option ?? null) as Record<string, unknown> | null;
        const id = asNonEmptyString(item?.id) ?? asNonEmptyString(item?.key);
        const text =
          asNonEmptyString(item?.text) ??
          asNonEmptyString(item?.label) ??
          asNonEmptyString(item?.content) ??
          asNonEmptyString(item?.value);
        const feedback =
          asNonEmptyString(item?.feedback) ??
          asNonEmptyString(item?.reason) ??
          asNonEmptyString(item?.rationale) ??
          asNonEmptyString(item?.hint);
        if (!id || !text) return null;
        return feedback ? { id, text, feedback } : { id, text };
      })
      .filter((option): option is { id: string; text: string; feedback?: string } => option != null);
    if (options.length >= 2) {
      const safeCorrectOptionId =
        correctOptionId && options.some((option) => option.id === correctOptionId)
          ? correctOptionId
          : options[0]?.id;
      if (!safeCorrectOptionId) return null;
      return {
        type: 'quiz',
        prompt,
        questions: [{ id: 'q1', prompt, options, correctOptionId: safeCorrectOptionId }],
      };
    }
  }

  if (normalizedType === 'single_choice' && Array.isArray(row.options)) {
    const correctOptionId =
      asNonEmptyString(row.correctOptionId) ??
      asNonEmptyString(row.correct_option_id) ??
      asNonEmptyString(row.correctAnswerId) ??
      asNonEmptyString(row.correct_answer_id) ??
      asNonEmptyString(row.correct);
    const options = row.options
      .map((option) => {
        const item = (option ?? null) as Record<string, unknown> | null;
        const id = asNonEmptyString(item?.id);
        const text = asNonEmptyString(item?.text);
        const feedback =
          asNonEmptyString(item?.feedback) ??
          asNonEmptyString(item?.reason) ??
          asNonEmptyString(item?.rationale) ??
          asNonEmptyString(item?.hint);
        if (!id || !text) return null;
        return feedback ? { id, text, feedback } : { id, text };
      })
      .filter((option): option is { id: string; text: string; feedback?: string } => option != null);
    if (options.length >= 2) {
      const safeCorrectOptionId =
        correctOptionId && options.some((option) => option.id === correctOptionId)
          ? correctOptionId
          : options[0]?.id;
      if (!safeCorrectOptionId) return null;
      return {
        type: 'quiz',
        prompt,
        questions: [{ id: 'q1', prompt, options, correctOptionId: safeCorrectOptionId }],
      };
    }
  }

  if (
    normalizedType === 'matching' &&
    (Array.isArray(row.leftItems) ||
      Array.isArray(row.left_items) ||
      Array.isArray(row.left) ||
      Array.isArray(row.pairsLeft)) &&
    (Array.isArray(row.rightItems) ||
      Array.isArray(row.right_items) ||
      Array.isArray(row.right) ||
      Array.isArray(row.pairsRight))
  ) {
    const rawLeft = (row.leftItems ?? row.left_items ?? row.left ?? row.pairsLeft ?? []) as unknown[];
    const rawRight = (row.rightItems ?? row.right_items ?? row.right ?? row.pairsRight ?? []) as unknown[];
    const leftItems = rawLeft
      .map((item) => {
        const entry = (item ?? null) as Record<string, unknown> | null;
        const id = asNonEmptyString(entry?.id) ?? asNonEmptyString(entry?.key);
        const text =
          asNonEmptyString(entry?.text) ?? asNonEmptyString(entry?.label) ?? asNonEmptyString(entry?.value);
        return id && text ? { id, text } : null;
      })
      .filter((item): item is { id: string; text: string } => item != null);
    const rightItems = rawRight
      .map((item) => {
        const entry = (item ?? null) as Record<string, unknown> | null;
        const id = asNonEmptyString(entry?.id) ?? asNonEmptyString(entry?.key);
        const text =
          asNonEmptyString(entry?.text) ?? asNonEmptyString(entry?.label) ?? asNonEmptyString(entry?.value);
        return id && text ? { id, text } : null;
      })
      .filter((item): item is { id: string; text: string } => item != null);
    if (leftItems.length >= 2 && rightItems.length >= 2) {
      return { type: 'matching', prompt, leftItems, rightItems };
    }
  }

  if (normalizedType === 'free_text' || normalizedType === 'open_text') {
    return {
      type: 'free_text',
      prompt,
      placeholder:
        asNonEmptyString(row.placeholder) ??
        asNonEmptyString(row.hint) ??
        asNonEmptyString(row.example),
    };
  }

  return null;
}

async function repairMissingExercise(input: {
  apiKey: string;
  model: string;
  reqId: string;
  requirementGoal: string;
  chapterContext: ReturnType<typeof normalizeChapterContext>;
  responseStep: RequirementPlanStep | null;
  message: string;
  expectsInput: InputMode;
}) {
  const expectedType = inferExpectedExerciseType(input.expectsInput, input.responseStep);
  if (!expectedType) return null;

  log(input.reqId, 'repair_missing_exercise_start', {
    expectsInput: input.expectsInput,
    expectedType,
    responseStepId: input.responseStep?.id ?? null,
    responseStepType: input.responseStep?.type ?? null,
    responseStepExerciseType: input.responseStep?.exerciseType ?? null,
  });

  const prompt = [
    'Du reparierst eine fehlerhafte Wissenspfad-Antwort.',
    'Es wurde ein Exercise-Schritt angekuendigt, aber das exercise-Objekt fehlt.',
    'Antworte NUR als JSON mit diesem Schema:',
    '{ "exercise": { ... } }',
    '',
    `Requirement-Ziel: ${input.requirementGoal}`,
    `Kapitelkontext: ${JSON.stringify(input.chapterContext)}`,
    `Aktueller Schritt: ${JSON.stringify(input.responseStep)}`,
    `Erwarteter Exercise-Typ: ${expectedType}`,
    `Nachricht an den Nutzer: ${JSON.stringify(input.message)}`,
    '',
    'Regeln:',
    `- Liefere genau ein exercise-Objekt vom Typ "${expectedType}".`,
    '- Die Aufgabe muss direkt zur Nachricht und zum aktuellen Schritt passen.',
    '- Bei quiz: liefere prompt und 2 bis 4 questions, jede mit 3 bis 5 Optionen, correctOptionId, optional explanation und pro Option ein kurzes feedback.',
    '- Bei matching: liefere prompt sowie 3 bis 5 leftItems und 3 bis 5 rightItems.',
    '- Bei free_text: liefere prompt und optional placeholder.',
    '- Kein zusaetzlicher Text ausserhalb des JSON.',
  ].join('\n');

  const repaired = await requestOpenAiJson({
    apiKey: input.apiKey,
    model: input.model,
    prompt,
    reqId: input.reqId,
    eventPrefix: 'repair_missing_exercise',
    maxOutputTokens: 1200,
  });

  const normalizedExercise = normalizeExercise(repaired?.exercise);
  log(input.reqId, 'repair_missing_exercise_result', {
    expectedType,
    rawHasExercise:
      repaired != null && typeof repaired === 'object' && 'exercise' in repaired ? true : false,
    rawExerciseSnippet: safeSnippet(JSON.stringify(repaired?.exercise ?? null), 500),
    normalizedExerciseType: normalizedExercise?.type ?? null,
  });
  return normalizedExercise;
}

function normalizeUserResponse(input: unknown): UserResponse | undefined {
  const row = (input ?? null) as Record<string, unknown> | null;
  if (!row || typeof row.kind !== 'string') return undefined;

  if ((row.kind === 'text' || row.kind === 'free_text') && typeof row.text === 'string') {
    return { kind: row.kind, text: safeSnippet(row.text, 320) };
  }

  if (row.kind === 'quiz' && Array.isArray(row.answers)) {
    const answers = row.answers
      .map((answer) => {
        const entry = (answer ?? null) as Record<string, unknown> | null;
        const questionId = asNonEmptyString(entry?.questionId);
        const selectedOptionId = asNonEmptyString(entry?.selectedOptionId);
        return questionId && selectedOptionId ? { questionId, selectedOptionId } : null;
      })
      .filter(
        (
          answer,
        ): answer is {
          questionId: string;
          selectedOptionId: string;
        } => answer != null,
      );
    return answers.length > 0 ? { kind: 'quiz', answers } : undefined;
  }

  if (row.kind === 'single_choice' && typeof row.selectedOptionId === 'string') {
    return {
      kind: 'quiz',
      answers: [{ questionId: 'q1', selectedOptionId: row.selectedOptionId }],
    };
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

function normalizeRequirementContext(input: unknown) {
  const row = (input ?? null) as Record<string, unknown> | null;
  const materialContext = asNonEmptyString(row?.materialContext);
  return {
    materialContext,
  };
}

function hasUserResponseForStep(history: HistoryMessage[], stepId?: string) {
  if (!stepId) return false;
  return history.some(
    (message) => message.role === 'user' && message.stepId === stepId && message.response != null,
  );
}

function getNextStepId(plan: RequirementPlan | null, currentStepId?: string) {
  if (!plan || !currentStepId) return null;
  const index = plan.steps.findIndex((step) => step.id === currentStepId);
  if (index < 0) return null;
  return plan.steps[index + 1]?.id ?? null;
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

function isExerciseInputMode(value: InputMode) {
  return value === 'quiz' || value === 'matching' || value === 'free_text';
}

function inferExpectedExerciseType(stepInput: InputMode, step: RequirementPlanStep | null) {
  if (stepInput === 'quiz' || stepInput === 'matching' || stepInput === 'free_text')
    return stepInput;
  if (step?.type === 'exercise' && step.exerciseType) return step.exerciseType;
  return null;
}

function expectedInputModeForStep(step: RequirementPlanStep | null): InputMode | null {
  if (!step) return null;
  if (step.type === 'exercise' && step.exerciseType) return step.exerciseType;
  return null;
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

async function requestOpenAiJson(input: {
  apiKey: string;
  model: string;
  prompt: string;
  reqId: string;
  eventPrefix: string;
  maxOutputTokens: number;
}) {
  let openaiJson: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const openaiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: input.model,
        temperature: 0.2,
        max_output_tokens: input.maxOutputTokens,
        input: [{ role: 'user', content: [{ type: 'input_text', text: input.prompt }] }],
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text().catch(() => '');
      log(input.reqId, `${input.eventPrefix}_not_ok`, {
        attempt,
        openaiStatus: openaiRes.status,
        errorSnippet: safeSnippet(errText, 900),
      });
      if (attempt === 0 && (openaiRes.status === 429 || openaiRes.status >= 500)) {
        await sleep(500 + attempt * 500);
        continue;
      }
      return null;
    }

    openaiJson = await openaiRes.json();
    const parsed = safeJsonParse(extractAssistantText(openaiJson));
    if (parsed && typeof parsed === 'object') return parsed;

    log(input.reqId, `${input.eventPrefix}_parse_failed`, {
      attempt,
      assistantSnippet: extractAssistantText(openaiJson).slice(0, 300),
    });
  }

  return null;
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
