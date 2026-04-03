import { useEffect } from 'react';
import { inkRepo } from '../repositories';
import { useInkStore } from './inkStore';
import type { InkStroke } from './types';

export type InkHydrateInput =
  | {
      kind: 'session';
      studySessionId: string;
      assetId: string;
      supersededAttemptIds?: ReadonlySet<string> | null;
    }
  | {
      kind: 'asset';
      assetId: string;
      studySessionId?: string;
      supersededAttemptIds?: ReadonlySet<string> | null;
    };

export function useInkHydrate(input: InkHydrateInput | null) {
  const setContext = useInkStore((s) => s.setContext);
  const hydrate = useInkStore((s) => s.hydrate);

  const inputKey = (() => {
    if (!input) return 'null';
    const superseded =
      input.supersededAttemptIds && input.supersededAttemptIds.size > 0
        ? Array.from(input.supersededAttemptIds).sort().join(',')
        : '';
    const studySessionId =
      input.kind === 'session' ? input.studySessionId : (input.studySessionId ?? '');
    return `${input.kind}:${studySessionId}:${input.assetId}:${superseded}`;
  })();

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!input) {
        setContext(null);
        hydrate([]);
        return;
      }
      const studySessionId = input.kind === 'session' ? input.studySessionId : input.studySessionId;
      if (studySessionId) {
        setContext({ studySessionId, assetId: input.assetId });
      } else {
        setContext(null);
      }
      const allStrokes: InkStroke[] =
        input.kind === 'session'
          ? await inkRepo.listBySessionAsset(input)
          : await inkRepo.listByAssetId(input.assetId);
      if (cancelled) return;
      const strokes =
        input.supersededAttemptIds && input.supersededAttemptIds.size > 0
          ? allStrokes.filter((stroke) => !input.supersededAttemptIds?.has(stroke.attemptId))
          : allStrokes;
      hydrate(strokes);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [inputKey, setContext, hydrate]);
}
