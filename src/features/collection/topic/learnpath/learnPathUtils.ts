import type { Chapter, LearnPathProgress, Requirement } from '../../../../domain/models';
import type {
  LearnPathExercise,
  LearnPathGroup,
  LearnPathMessage,
  LearnPathRequirementOverviewItem,
  LearnPathTurnResponse,
  RequirementPlan,
  RequirementPlanHistoryMessage,
  RequirementPlanStep,
} from './types';

export function buildRequirementGoal(requirement: Requirement): string {
  const description = requirement.description?.trim();
  return description ? `${requirement.name}. ${description}` : requirement.name;
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

  if (response.kind === 'single_choice') {
    const option =
      exercise?.type === 'single_choice'
        ? exercise.options.find((item) => item.id === response.selectedOptionId)
        : undefined;
    return option ? option.text : 'Auswahl gesendet';
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
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function buildRequirementOverviewItems(
  groups: LearnPathGroup[],
  progressRows: LearnPathProgress[],
): LearnPathRequirementOverviewItem[] {
  const learnProgressByRequirementId = new Map(
    progressRows
      .filter((row) => row.mode === 'learn')
      .map((row) => [row.requirementId, row] as const),
  );
  const reviewProgressByRequirementId = new Map(
    progressRows
      .filter((row) => row.mode === 'review')
      .map((row) => [row.requirementId, row] as const),
  );

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
  return progressRows
    .filter((row) => row.status === 'in_progress')
    .sort((a, b) => b.updatedAtMs - a.updatedAtMs)[0];
}

export function getFirstOpenRequirement(
  overviewItems: LearnPathRequirementOverviewItem[],
): LearnPathRequirementOverviewItem | undefined {
  return overviewItems.find((item) => !item.learnProgress || item.learnProgress.status !== 'completed');
}
