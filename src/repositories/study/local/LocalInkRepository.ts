import { db } from '../../../db/db';
import type { InkStroke } from '../../../domain/models';

export class LocalInkRepository {
  async listBySessionAsset(input: {
    studySessionId: string;
    assetId: string;
  }): Promise<InkStroke[]> {
    return db.inkStrokes
      .where('[studySessionId+assetId]')
      .equals([input.studySessionId, input.assetId])
      .toArray();
  }

  async upsert(stroke: InkStroke): Promise<void> {
    await db.inkStrokes.put(stroke);
  }

  async bulkUpsert(strokes: InkStroke[]): Promise<void> {
    if (strokes.length === 0) return;
    await db.inkStrokes.bulkPut(strokes);
  }

  async deleteByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await db.inkStrokes.bulkDelete(ids);
  }

  async deleteByAttempt(attemptId: string): Promise<void> {
    await db.inkStrokes.where('attemptId').equals(attemptId).delete();
  }

  async listByAttempt(attemptId: string): Promise<InkStroke[]> {
    return db.inkStrokes.where('attemptId').equals(attemptId).toArray();
  }

  async translateAttempt(input: { attemptId: string; dx: number; dy: number }): Promise<void> {
    const { attemptId, dx, dy } = input;
    await db.inkStrokes
      .where('attemptId')
      .equals(attemptId)
      .modify((s: InkStroke) => {
        s.points = s.points.map(([x, y, p, t]) => [x + dx, y + dy, p, t]);
        s.bbox = {
          minX: s.bbox.minX + dx,
          minY: s.bbox.minY + dy,
          maxX: s.bbox.maxX + dx,
          maxY: s.bbox.maxY + dy,
        };
        s.updatedAtMs = Date.now();
      });
  }

  async translateStrokes(input: { strokeIds: string[]; dx: number; dy: number }): Promise<void> {
    const { strokeIds, dx, dy } = input;
    if (strokeIds.length === 0) return;
    const ids = new Set(strokeIds);
    const strokes = await db.inkStrokes.filter((s) => ids.has(s.id)).toArray();
    for (const s of strokes) {
      s.points = s.points.map(([x, y, p, t]) => [x + dx, y + dy, p, t]);
      s.bbox = {
        minX: s.bbox.minX + dx,
        minY: s.bbox.minY + dy,
        maxX: s.bbox.maxX + dx,
        maxY: s.bbox.maxY + dy,
      };
      s.updatedAtMs = Date.now();
    }
    await db.inkStrokes.bulkPut(strokes);
  }
}
