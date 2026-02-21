import { useCallback } from 'react';
import { inkRepo } from '../repositories';
import { useInkStore } from './inkStore';
import type { InkStroke } from './types';

export function useInkActions() {
  const exec = useInkStore((s) => s.exec);
  const undo = useInkStore((s) => s.undo);
  const redo = useInkStore((s) => s.redo);

  const commitStroke = useCallback(
    async (stroke: InkStroke) => {
      await inkRepo.upsert(stroke);
      exec({ kind: 'add', stroke });
    },
    [exec],
  );

  const deleteStrokes = useCallback(
    async (strokes: InkStroke[]) => {
      if (strokes.length === 0) return;
      await inkRepo.deleteByIds(strokes.map((s) => s.id));
      exec({ kind: 'delete', strokes });
    },
    [exec],
  );

  const translateAttempt = useCallback(
    async (input: { attemptId: string; dx: number; dy: number }) => {
      if (!input.dx && !input.dy) return;
      await inkRepo.translateAttempt(input);
      exec({ kind: 'translateAttempt', ...input });
    },
    [exec],
  );

  const translateStrokes = useCallback(
    async (input: { strokeIds: string[]; dx: number; dy: number }) => {
      if (!input.dx && !input.dy) return;
      if (input.strokeIds.length === 0) return;
      await inkRepo.translateStrokes(input);
      exec({ kind: 'translateStrokes', ...input });
    },
    [exec],
  );

  const undoWithPersist = useCallback(async () => {
    const cmd = undo();
    if (!cmd) return;
    if (cmd.kind === 'add') {
      await inkRepo.deleteByIds([cmd.stroke.id]);
    } else if (cmd.kind === 'delete') {
      await inkRepo.bulkUpsert(cmd.strokes);
    } else if (cmd.kind === 'translateAttempt') {
      await inkRepo.translateAttempt({ attemptId: cmd.attemptId, dx: -cmd.dx, dy: -cmd.dy });
    } else if (cmd.kind === 'translateStrokes') {
      await inkRepo.translateStrokes({
        strokeIds: cmd.strokeIds,
        dx: -cmd.dx,
        dy: -cmd.dy,
      });
    }
  }, [undo]);

  const redoWithPersist = useCallback(async () => {
    const cmd = redo();
    if (!cmd) return;
    if (cmd.kind === 'add') {
      await inkRepo.upsert(cmd.stroke);
    } else if (cmd.kind === 'delete') {
      await inkRepo.deleteByIds(cmd.strokes.map((s) => s.id));
    } else if (cmd.kind === 'translateAttempt') {
      await inkRepo.translateAttempt({ attemptId: cmd.attemptId, dx: cmd.dx, dy: cmd.dy });
    } else if (cmd.kind === 'translateStrokes') {
      await inkRepo.translateStrokes({
        strokeIds: cmd.strokeIds,
        dx: cmd.dx,
        dy: cmd.dy,
      });
    }
  }, [redo]);

  return {
    commitStroke,
    deleteStrokes,
    translateAttempt,
    translateStrokes,
    undoWithPersist,
    redoWithPersist,
  };
}
