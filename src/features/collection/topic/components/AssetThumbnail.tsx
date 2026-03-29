import { useEffect, useRef, useState } from 'react';
import type { AssetFile, AssetType } from '../../../../domain/models';
import { pdfjs } from '../../../session/viewer/pdfjs';

const THUMBNAIL_WIDTH = 160;
const THUMBNAIL_HEIGHT = 220;
const THUMBNAIL_QUALITY = 0.45;

type ThumbnailPayload = {
  src: string | null;
  kind: 'image' | 'pdf' | 'fallback';
};

const thumbnailCache = new Map<string, ThumbnailPayload>();
const thumbnailPending = new Map<string, Promise<ThumbnailPayload>>();

function createThumbnailCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = THUMBNAIL_WIDTH;
  canvas.height = THUMBNAIL_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return { canvas, ctx };
}

function drawContained(
  sourceWidth: number,
  sourceHeight: number,
  draw: (x: number, y: number, width: number, height: number) => void,
) {
  const scale = Math.min(THUMBNAIL_WIDTH / sourceWidth, THUMBNAIL_HEIGHT / sourceHeight);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const x = Math.round((THUMBNAIL_WIDTH - width) / 2);
  const y = Math.round((THUMBNAIL_HEIGHT - height) / 2);
  draw(x, y, width, height);
}

function canvasToDataUrl(canvas: HTMLCanvasElement) {
  return canvas.toDataURL('image/webp', THUMBNAIL_QUALITY);
}

async function loadImageElement(blob: Blob) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.decoding = 'async';
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image preview failed to load'));
    };
    img.src = url;
  });
}

async function createImageThumbnail(blob: Blob) {
  const img = await loadImageElement(blob);
  const { canvas, ctx } = createThumbnailCanvas();
  drawContained(
    img.naturalWidth || THUMBNAIL_WIDTH,
    img.naturalHeight || THUMBNAIL_HEIGHT,
    (x, y, width, height) => {
      ctx.drawImage(img, x, y, width, height);
    },
  );
  return canvasToDataUrl(canvas);
}

async function createPdfThumbnail(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  try {
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(
      THUMBNAIL_WIDTH / baseViewport.width,
      THUMBNAIL_HEIGHT / baseViewport.height,
    );
    const viewport = page.getViewport({ scale });
    const renderCanvas = document.createElement('canvas');
    renderCanvas.width = Math.max(1, Math.ceil(viewport.width));
    renderCanvas.height = Math.max(1, Math.ceil(viewport.height));
    const renderContext = renderCanvas.getContext('2d');
    if (!renderContext) throw new Error('Canvas context unavailable');
    await page.render({ canvas: renderCanvas, canvasContext: renderContext, viewport }).promise;

    const { canvas, ctx } = createThumbnailCanvas();
    drawContained(renderCanvas.width, renderCanvas.height, (x, y, width, height) => {
      ctx.drawImage(renderCanvas, x, y, width, height);
    });
    return canvasToDataUrl(canvas);
  } finally {
    await pdf.destroy();
  }
}

async function buildThumbnail(
  assetId: string,
  loadFile: (assetId: string) => Promise<AssetFile | undefined>,
) {
  const file = await loadFile(assetId);
  if (!file) return { src: null, kind: 'fallback' } satisfies ThumbnailPayload;

  const mime = file.mimeType || '';
  const lowerName = file.originalName.toLowerCase();
  const isPdf = mime === 'application/pdf' || lowerName.endsWith('.pdf');
  const isImage = mime.startsWith('image/');

  if (isImage) {
    return { src: await createImageThumbnail(file.blob), kind: 'image' } satisfies ThumbnailPayload;
  }

  if (isPdf) {
    return { src: await createPdfThumbnail(file.blob), kind: 'pdf' } satisfies ThumbnailPayload;
  }

  return { src: null, kind: 'fallback' } satisfies ThumbnailPayload;
}

async function loadThumbnail(
  assetId: string,
  loadFile: (assetId: string) => Promise<AssetFile | undefined>,
) {
  const cached = thumbnailCache.get(assetId);
  if (cached) return cached;

  const pending = thumbnailPending.get(assetId);
  if (pending) return pending;

  const promise = buildThumbnail(assetId, loadFile)
    .catch(() => ({ src: null, kind: 'fallback' }) satisfies ThumbnailPayload)
    .then((result) => {
      thumbnailCache.set(assetId, result);
      thumbnailPending.delete(assetId);
      return result;
    });

  thumbnailPending.set(assetId, promise);
  return promise;
}

export function AssetThumbnail(props: {
  assetId: string;
  assetType: AssetType;
  title: string;
  loadFile: (assetId: string) => Promise<AssetFile | undefined>;
}) {
  const { assetId, title, loadFile } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(() => thumbnailCache.has(assetId));
  const [loading, setLoading] = useState(() => shouldLoad && !thumbnailCache.has(assetId));
  const [thumbnail, setThumbnail] = useState<ThumbnailPayload | null>(
    () => thumbnailCache.get(assetId) ?? null,
  );

  useEffect(() => {
    if (thumbnailCache.has(assetId)) {
      setThumbnail(thumbnailCache.get(assetId) ?? null);
      setShouldLoad(true);
      setLoading(false);
      return;
    }

    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '240px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [assetId, setThumbnail]);

  useEffect(() => {
    if (!shouldLoad) return;

    let cancelled = false;
    const cached = thumbnailCache.get(assetId);
    if (cached) {
      setThumbnail(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    void loadThumbnail(assetId, loadFile).then((result) => {
      if (cancelled) return;
      setThumbnail(result);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [assetId, loadFile, shouldLoad]);

  return (
    <div
      ref={containerRef}
      className="relative shadow-lg group-hover:scale-105 active:scale-95 transition-all duration-300 h-24 w-16 overflow-hidden rounded-md"
    >
      {thumbnail?.src ? (
        <img
          src={thumbnail.src}
          alt={`Vorschau von ${title}`}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : null}

      {loading ? <div className="absolute inset-0 animate-pulse bg-white/5" /> : null}
    </div>
  );
}
