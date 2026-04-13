import type { Chapter, LearnPathProgress, Requirement } from '../../../../domain/models';
import type {
  LearnPathExercise,
  LearnPathExerciseState,
  LearnPathExerciseType,
  LearnPathGroup,
  LearnPathInputMode,
  LearnPathInteractionSurface,
  LearnPathMessage,
  LearnPathRequirementOverviewItem,
  LearnPathTurnResponse,
  RequirementPlan,
  RequirementPlanHistoryMessage,
  RequirementPlanStep,
} from './types';

export function buildRequirementGoal(requirement: Requirement): string {
  const description = requirement.description?.trim();
  const materialContext = requirement.materialContext?.trim();
  const materialText = materialContext
    ? ` Unterrichtsmaterial-Kontext: ${materialContext.slice(0, 2400)}`
    : '';
  return `${description ? `${requirement.name}. ${description}` : requirement.name}${materialText}`;
}

export function getNextRequirementPosition(
  groups: LearnPathGroup[],
  chapterIndex: number,
  requirementIndex: number,
) {
  const currentGroup = groups[chapterIndex];
  if (!currentGroup) return null;
  if (requirementIndex + 1 < currentGroup.requirements.length) {
    return { chapterIndex, requirementIndex: requirementIndex + 1 };
  }
  if (chapterIndex + 1 < groups.length) {
    return { chapterIndex: chapterIndex + 1, requirementIndex: 0 };
  }
  return null;
}

export function buildRequirementHistory(
  messages: LearnPathMessage[],
  chapterId: string,
  requirementId: string,
): RequirementPlanHistoryMessage[] {
  return messages
    .filter(
      (
        message,
      ): message is LearnPathMessage & {
        role: 'user' | 'assistant';
      } =>
        message.chapterId === chapterId &&
        message.requirementId === requirementId &&
        (message.role === 'user' || message.role === 'assistant'),
    )
    .map((message) => ({
      role: message.role,
      content: message.content,
      stepId: message.stepId,
      stepType: message.stepType,
      messageKind: message.messageKind,
      response: message.response,
    }));
}

export function clampMastery(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function clampMasteryDelta(value: number) {
  return Math.max(0, Math.min(0.2, Number.isFinite(value) ? value : 0));
}

export function formatMasteryDelta(value: number) {
  return `+${Math.round(value * 100)}% Mastery`;
}

export function formatPlanStepList(steps: RequirementPlanStep[]) {
  return steps.length > 0 ? steps.map((step) => step.title).join(', ') : '–';
}

export function buildGroupedRequirements(
  chapters: Chapter[],
  requirements: Requirement[],
): LearnPathGroup[] {
  return chapters
    .map((chapter) => ({
      chapter,
      requirements: [...requirements]
        .filter((requirement) => requirement.chapterId === chapter.id)
        .sort((a, b) => a.id.localeCompare(b.id)),
    }))
    .filter((group) => group.requirements.length > 0);
}

export function getCurrentRequirementPosition(
  groupedRequirements: LearnPathGroup[],
  currentChapterIndex: number,
  currentRequirementIndex: number,
  hasCurrentRequirement: boolean,
) {
  let offset = 0;
  for (let chapterIndex = 0; chapterIndex < groupedRequirements.length; chapterIndex += 1) {
    if (chapterIndex < currentChapterIndex) {
      offset += groupedRequirements[chapterIndex]?.requirements.length ?? 0;
    } else {
      break;
    }
  }
  return hasCurrentRequirement ? offset + currentRequirementIndex + 1 : 0;
}

export function getActivePlanStep(
  plan: RequirementPlan | null,
  stepId: string | null,
): RequirementPlanStep | undefined {
  if (!plan || !stepId) return undefined;
  return plan.steps.find((step) => step.id === stepId);
}

export function getPlanStepPosition(plan: RequirementPlan | null, stepId: string | null) {
  if (!plan || !stepId) return 0;
  const index = plan.steps.findIndex((step) => step.id === stepId);
  return index >= 0 ? index + 1 : 0;
}

export function describeResponse(response: LearnPathTurnResponse, exercise?: LearnPathExercise | null) {
  if (response.kind === 'text' || response.kind === 'free_text') return response.text;

  if (response.kind === 'quiz') {
    if (exercise?.type !== 'quiz') return 'Quiz-Antwort gesendet';
    const questionLookup = new Map(exercise.questions.map((question) => [question.id, question]));
    const answerLines = response.answers
      .map((answer, index) => {
        const question = questionLookup.get(answer.questionId);
        const option = question?.options.find((item) => item.id === answer.selectedOptionId);
        const isCorrect = question?.correctOptionId === answer.selectedOptionId;
        const correctOption = question?.options.find((item) => item.id === question.correctOptionId);
        if (isCorrect) {
          return `${index + 1}. ${question?.prompt ?? answer.questionId}: ${option?.text ?? answer.selectedOptionId} (richtig)`;
        }
        return `${index + 1}. ${question?.prompt ?? answer.questionId}: ${option?.text ?? answer.selectedOptionId} (falsch, richtig: ${correctOption?.text ?? question?.correctOptionId ?? '-'})`;
      })
      .join('\n');
    const summaryLine = response.summary
      ? `Ergebnis: ${response.summary.score}/${response.summary.total} korrekt`
      : '';
    return [summaryLine, answerLines].filter(Boolean).join('\n');
  }

  const leftLookup =
    exercise?.type === 'matching'
      ? Object.fromEntries(exercise.leftItems.map((item) => [item.id, item.text]))
      : {};
  const rightLookup =
    exercise?.type === 'matching'
      ? Object.fromEntries(exercise.rightItems.map((item) => [item.id, item.text]))
      : {};

  return response.pairs
    .map((pair) => `${leftLookup[pair.leftId] ?? pair.leftId} -> ${rightLookup[pair.rightId] ?? pair.rightId}`)
    .join('\n');
}

export function serializeRequirementPlan(plan: RequirementPlan | null) {
  return plan ? JSON.stringify(plan) : undefined;
}

export function parseRequirementPlanJson(value?: string) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as RequirementPlan;
    return parsed && typeof parsed === 'object' && Array.isArray(parsed.steps) ? parsed : null;
  } catch {
    return null;
  }
}

export function serializeLearnPathMessages(messages: LearnPathMessage[]) {
  return messages.length > 0 ? JSON.stringify(messages) : undefined;
}

export function parseLearnPathMessagesJson(value?: string) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as LearnPathMessage[];
    return Array.isArray(parsed) ? parsed.map(normalizeLegacyMessage).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function deriveInteractionFromAssistantTurn(input: {
  inputMode: LearnPathInputMode;
  awaitUserReply: boolean;
  exerciseState: LearnPathExerciseState;
}) {
  const waitingForUser = input.awaitUserReply || input.inputMode !== 'none';
  const hasReadyExercise = input.exerciseState.status === 'ready' && input.exerciseState.exercise != null;
  const interactionSurface: LearnPathInteractionSurface = hasReadyExercise
    ? 'exercise'
    : waitingForUser
      ? 'chat'
      : input.inputMode === 'none'
        ? 'continue'
        : 'idle';
  return {
    waitingForUser,
    canContinue: !waitingForUser && interactionSurface === 'continue',
    interactionSurface,
  };
}

export function expectedExerciseTypeFromInputMode(
  inputMode: LearnPathInputMode | undefined,
): LearnPathExerciseType | null {
  if (inputMode === 'quiz' || inputMode === 'matching' || inputMode === 'free_text') return inputMode;
  return null;
}

export function buildRequirementOverviewItems(
  groups: LearnPathGroup[],
  progressRows: LearnPathProgress[],
): LearnPathRequirementOverviewItem[] {
  const learnProgressByRequirementId = pickLatestProgressByRequirement(progressRows, 'learn');
  const reviewProgressByRequirementId = pickLatestProgressByRequirement(progressRows, 'review');

  return groups.flatMap((group) =>
    group.requirements.map((requirement) => {
      const learnProgress = learnProgressByRequirementId.get(requirement.id);
      const reviewProgress = reviewProgressByRequirementId.get(requirement.id);
      let status: LearnPathRequirementOverviewItem['status'] = 'open';

      if (reviewProgress?.status === 'in_progress') status = 'reviewing';
      else if (learnProgress?.status === 'in_progress') status = 'in_progress';
      else if (learnProgress?.status === 'completed') status = 'completed';

      return {
        chapter: group.chapter,
        requirement,
        status,
        learnProgress,
        reviewProgress,
      };
    }),
  );
}

export function getLatestInProgressProgress(progressRows: LearnPathProgress[]) {
  const latestRows = [
    ...pickLatestProgressByRequirement(progressRows, 'learn').values(),
    ...pickLatestProgressByRequirement(progressRows, 'review').values(),
  ];
  return latestRows
    .filter((row) => row.status === 'in_progress')
    .sort((a, b) => b.updatedAtMs - a.updatedAtMs)[0];
}

export function getFirstOpenRequirement(
  overviewItems: LearnPathRequirementOverviewItem[],
): LearnPathRequirementOverviewItem | undefined {
  return overviewItems.find((item) => !item.learnProgress || item.learnProgress.status !== 'completed');
}

function pickLatestProgressByRequirement(
  progressRows: LearnPathProgress[],
  mode: LearnPathProgress['mode'],
) {
  const map = new Map<string, LearnPathProgress>();
  for (const row of progressRows) {
    if (row.mode !== mode) continue;
    const current = map.get(row.requirementId);
    if (!current || shouldPreferProgressRow(current, row)) {
      map.set(row.requirementId, row);
    }
  }
  return map;
}

function shouldPreferProgressRow(current: LearnPathProgress, next: LearnPathProgress) {
  if (current.status !== next.status) {
    if (next.status === 'completed') return true;
    if (current.status === 'completed') return false;
  }
  return next.updatedAtMs >= current.updatedAtMs;
}

function normalizeLegacyMessage(message: LearnPathMessage) {
  const rawMessage = message as {
    inputMode?: string;
    exercise?: {
      type?: string;
      prompt?: string;
      options?: { id: string; text: string }[];
    };
    response?: {
      kind?: string;
      selectedOptionId?: string;
    };
  };
  const inputMode = rawMessage.inputMode === 'single_choice' ? 'quiz' : message.inputMode;
  const exercise =
    rawMessage.exercise?.type === 'single_choice'
      ? {
          type: 'quiz' as const,
          prompt: rawMessage.exercise.prompt ?? '',
          // Legacy single choice payloads had no explicit correct answer. We default to first option.
          // This keeps old history parseable without blocking the current quiz flow.
          questions: [
            {
              id: 'q1',
              prompt: rawMessage.exercise.prompt ?? '',
              options: rawMessage.exercise.options ?? [],
              correctOptionId: rawMessage.exercise.options?.[0]?.id ?? 'opt_1',
            },
          ],
        }
      : message.exercise;
  const response =
    rawMessage.response?.kind === 'single_choice'
      ? {
          kind: 'quiz' as const,
          answers: [
            {
              questionId: 'q1',
              selectedOptionId: rawMessage.response.selectedOptionId ?? '',
            },
          ].filter((answer) => answer.selectedOptionId),
        }
      : message.response;
  return {
    ...message,
    inputMode,
    exercise,
    response: response && response.kind === 'quiz' && response.answers.length === 0 ? undefined : response,
  };
}
