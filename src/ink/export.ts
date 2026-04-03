import type { InkStroke } from '../domain/models';
import { inkRepo } from '../repositories';
import { bboxExpand, bboxUnion } from './geometry';
import { drawStrokeFill } from './stroke';

export async function downloadAttemptPng(input: { attemptId: string; filename?: string }) {
  const strokes = await inkRepo.listByAttempt(input.attemptId);
  if (strokes.length === 0) throw new Error('Keine Ink-Daten für diesen Attempt');

  const bbox = strokes.map((s) => s.bbox).reduce((acc, b) => bboxUnion(acc, b));
  const pad = 24;
  const target = bboxExpand(bbox, pad);

  const scale = 2;
  const w = Math.max(1, Math.ceil((target.maxX - target.minX) * scale));
  const h = Math.max(1, Math.ceil((target.maxY - target.minY) * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context missing');

  ctx.setTransform(scale, 0, 0, scale, -target.minX * scale, -target.minY * scale);
  for (const s of strokes) drawStrokeFill(ctx, s);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('PNG Export fehlgeschlagen'))),
      'image/png',
    );
  });

  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = input.filename ?? `teilaufgabe_${input.attemptId.slice(0, 8)}.png`;
    a.click();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export async function renderInkOnlyRasterBlob(
  strokes: InkStroke[],
  mime: 'image/png' | 'image/jpeg',
  jpegQuality = 0.92,
): Promise<Blob> {
  if (strokes.length === 0) throw new Error('Keine Ink-Daten für den Export');

  const bbox = strokes.map((s) => s.bbox).reduce((acc, b) => bboxUnion(acc, b));
  const pad = 24;
  const target = bboxExpand(bbox, pad);

  const scale = 2;
  const w = Math.max(1, Math.ceil((target.maxX - target.minX) * scale));
  const h = Math.max(1, Math.ceil((target.maxY - target.minY) * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context missing');

  ctx.setTransform(scale, 0, 0, scale, -target.minX * scale, -target.minY * scale);
  for (const s of strokes) drawStrokeFill(ctx, s);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Export fehlgeschlagen'))),
      mime,
      mime === 'image/jpeg' ? jpegQuality : undefined,
    );
  });
}

export async function pngBlobToJpegBlob(pngBlob: Blob, quality = 0.92): Promise<Blob> {
  const bitmap = await createImageBitmap(pngBlob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context missing');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('JPEG-Konvertierung fehlgeschlagen'))),
      'image/jpeg',
      quality,
    );
  });
}
