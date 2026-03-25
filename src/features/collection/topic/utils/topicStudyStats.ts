import type { StudySession } from '../../../../domain/models';
import { attemptRepo, studySessionRepo } from '../../../../repositories';

export type TopicStudyAggregates = {
  completedSessions: StudySession[];
  completedSessionCount: number;
  sessionRevision: string;
  totalWorkSeconds: number;
  totalAttempts: number;
  lastStudiedMs: number | null;
};

export async function loadTopicStudyAggregates(topicId: string): Promise<TopicStudyAggregates> {
  const sessions = await studySessionRepo.listByTopic(topicId);
  const completedSessions = sessions.filter((s): s is StudySession & { endedAtMs: number } =>
    typeof s.endedAtMs === 'number',
  );
  const completedSessionCount = completedSessions.length;
  const maxEnded =
    completedSessionCount === 0
      ? 0
      : Math.max(...completedSessions.map((s) => s.endedAtMs ?? 0));
  const sessionRevision = `${completedSessionCount}:${maxEnded}`;

  const ids = completedSessions.map((s) => s.id);
  const attempts = await attemptRepo.listByStudySessionIds(ids);
  let totalWorkSeconds = 0;
  for (const a of attempts) totalWorkSeconds += Math.max(0, a.seconds);

  return {
    completedSessions,
    completedSessionCount,
    sessionRevision,
    totalWorkSeconds,
    totalAttempts: attempts.length,
    lastStudiedMs: maxEnded > 0 ? maxEnded : null,
  };
}
