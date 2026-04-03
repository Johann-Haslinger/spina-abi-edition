import { useEffect, useState } from 'react';
import { subjectRepo, topicRepo } from '../../repositories';

export function useSubjectTopicLabels(subjectId: string | undefined, topicId: string | undefined) {
  const [subjectName, setSubjectName] = useState<string | null>(null);
  const [topicName, setTopicName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!subjectId || !topicId) {
      setSubjectName(null);
      setTopicName(null);
      return;
    }
    void (async () => {
      const [s, t] = await Promise.all([subjectRepo.get(subjectId), topicRepo.get(topicId)]);
      if (cancelled) return;
      setSubjectName(s?.name ?? null);
      setTopicName(t?.name ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [subjectId, topicId]);

  const subtitle =
    subjectName && topicName ? `${subjectName} · ${topicName}` : (subjectName ?? topicName ?? '');

  return { subjectName, topicName, subtitle };
}
