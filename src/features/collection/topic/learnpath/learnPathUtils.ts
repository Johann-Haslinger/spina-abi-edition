import type { Chapter, Requirement } from '../../../../domain/models';
import type { RequirementRailHistoryMessage } from './ai/requirementRailAiClient';
import type { LearnPathGroup, LearnPathMessage } from './types';

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
): RequirementRailHistoryMessage[] {
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

export function formatRailStateList(states: string[]) {
  return states.length > 0 ? states.join(', ') : '–';
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
