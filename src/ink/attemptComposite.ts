import type { PDFDocumentProxy } from 'pdfjs-dist';
import { pdfjs } from '../features/session/viewer/pdfjs';
import { inkRepo } from '../repositories';
import { bboxExpand, bboxUnion } from './geometry';
import { drawStrokeFill } from './stroke';

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('FileReader Fehler'));
    fr.onload = () => resolve(String(fr.result || ''));
    fr.readAsDataURL(blob);
  });
}

async function loadPdfDoc(pdfData: Uint8Array, maxPdfBytes: number): Promise<PDFDocumentProxy> {
  if (pdfData.byteLength > maxPdfBytes) throw new Error('PDF ist zu groß für den Upload.');
  const task = pdfjs.getDocument({ data: pdfData.slice(0) });
  return await task.promise;
}

type InkBBox = { minX: number; minY: number; maxX: number; maxY: number };

const RENDER_SCALE = 1.6;
const PAD_X = 16 * 2;
const PAD_TOP = 24;
const PAGE_GAP = 24;

export async function renderAttemptCompositePngDataUrl(input: {
  attemptId: string;
  pdfData: Uint8Array;
  maxPdfBytes: number;
  maxOutputPixels: number;
}) {
  const blob = await renderAttemptCompositePngBlob(input);
  return await blobToDataUrl(blob);
}

export async function renderAttemptCompositePngBlob(input: {
  attemptId: string;
  pdfData: Uint8Array;
  maxPdfBytes: number;
  maxOutputPixels: number;
}) {
  const strokes = await inkRepo.listByAttempt(input.attemptId);
  if (strokes.length === 0) throw new Error('Keine Ink-Daten für diesen Attempt');

  const bbox = strokes.map((s) => s.bbox).reduce((acc, b) => bboxUnion(acc, b)) as InkBBox;
  const pad = 24;
  const target = bboxExpand(bbox, pad) as InkBBox;

  const outputScale = 2;
  const w = Math.max(1, Math.ceil((target.maxX - target.minX) * outputScale));
  const h = Math.max(1, Math.ceil((target.maxY - target.minY) * outputScale));
  if (w * h > input.maxOutputPixels) {
    throw new Error('Das Bild ist zu groß (Attempt-Bereich).');
  }

  const doc = await loadPdfDoc(input.pdfData, input.maxPdfBytes);
  const { pageNumber, pageX, pageY } = await locatePageForBBox({ doc, bbox: target });
  const page = await doc.getPage(pageNumber);
  const pageVp = page.getViewport({ scale: RENDER_SCALE });

  const crop = cropRectToPage({
    crop: {
      x: target.minX - pageX,
      y: target.minY - pageY,
      w: target.maxX - target.minX,
      h: target.maxY - target.minY,
    },
    pageW: pageVp.width,
    pageH: pageVp.height,
  });

  const pdfBg = await renderPdfCropToCanvas({
    page,
    crop,
    outputScale,
    canvasW: w,
    canvasH: h,
  });

  const ctx = pdfBg.getContext('2d');
  if (!ctx) throw new Error('Canvas context missing');
  ctx.setTransform(
    outputScale,
    0,
    0,
    outputScale,
    -target.minX * outputScale,
    -target.minY * outputScale,
  );
  for (const s of strokes) drawStrokeFill(ctx, s);

  const blob = await new Promise<Blob>((resolve, reject) => {
    pdfBg.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('PNG Export fehlgeschlagen'))),
      'image/png',
    );
  });
  return blob;
}

async function locatePageForBBox(input: { doc: PDFDocumentProxy; bbox: InkBBox }) {
  const numPages = input.doc.numPages;

  // Compute max width at RENDER_SCALE (same as viewer).
  let maxW = 0;
  const pageSizes: Array<{ w: number; h: number }> = [];
  for (let n = 1; n <= numPages; n++) {
    const page = await input.doc.getPage(n);
    const vp = page.getViewport({ scale: RENDER_SCALE });
    maxW = Math.max(maxW, vp.width);
    pageSizes.push({ w: vp.width, h: vp.height });
  }

  const cy = (input.bbox.minY + input.bbox.maxY) / 2;
  let y = PAD_TOP;
  let best = 1;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < pageSizes.length; i++) {
    const n = i + 1;
    const h = pageSizes[i]!.h;
    const y0 = y;
    const y1 = y + h;
    const dist = cy < y0 ? y0 - cy : cy > y1 ? cy - y1 : 0;
    if (dist < bestDist) {
      bestDist = dist;
      best = n;
    }
    y = y + h + PAGE_GAP;
  }

  const { w: bestW } = pageSizes[best - 1]!;
  const pageX = PAD_X / 2 + (maxW - bestW) / 2;
  let pageY = PAD_TOP;
  for (let i = 0; i < best - 1; i++) pageY += pageSizes[i]!.h + PAGE_GAP;

  return { pageNumber: best, pageX, pageY };
}

function cropRectToPage(input: {
  crop: { x: number; y: number; w: number; h: number };
  pageW: number;
  pageH: number;
}) {
  const x = Math.max(0, Math.min(input.pageW, input.crop.x));
  const y = Math.max(0, Math.min(input.pageH, input.crop.y));
  const w = Math.max(1, Math.min(input.pageW - x, input.crop.w));
  const h = Math.max(1, Math.min(input.pageH - y, input.crop.h));
  return { x, y, w, h };
}

async function renderPdfCropToCanvas(input: {
  page: Awaited<ReturnType<PDFDocumentProxy['getPage']>>;
  crop: { x: number; y: number; w: number; h: number };
  outputScale: number;
  canvasW: number;
  canvasH: number;
}) {
  const canvas = document.createElement('canvas');
  canvas.width = input.canvasW;
  canvas.height = input.canvasH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context missing');

  // White background so the crop looks like paper.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const baseVp = input.page.getViewport({ scale: RENDER_SCALE * input.outputScale });
  const offsetX = -input.crop.x * input.outputScale;
  const offsetY = -input.crop.y * input.outputScale;
  const cropVp = (baseVp as unknown as { clone: (o: unknown) => unknown }).clone({
    offsetX,
    offsetY,
    // width/height are accepted by pdfjs viewport clone in recent versions; fallback is harmless.
    width: input.crop.w * input.outputScale,
    height: input.crop.h * input.outputScale,
  }) as unknown;

  const renderTask = input.page.render({
    canvasContext: ctx,
    viewport: cropVp as never,
    canvas,
  });
  await renderTask.promise;
  return canvas;
}

export async function pdfBytesSha256Hex(pdfBytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', pdfBytes.slice().buffer as ArrayBuffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function pdfBytesToBase64(pdfBytes: Uint8Array) {
  return bytesToBase64(pdfBytes);
}
