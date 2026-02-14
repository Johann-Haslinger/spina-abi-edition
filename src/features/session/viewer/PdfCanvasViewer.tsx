import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { pdfjs } from './pdfjs';
import { clamp, hexToRgba, INITIAL_TOP_MARGIN } from './viewerUtils';

type PdfCanvasViewerProps = {
  data: Uint8Array;
  pageNumber: number;
  onPageNumberChange: (next: number) => void;
  accentColor?: string;
};

type Point = { x: number; y: number };

type PanGesture = { kind: 'pan'; startPan: Point; startPointer: Point };
type PinchGesture = {
  kind: 'pinch';
  startPan: Point;
  startRatio: number;
  startDistance: number;
  startMid: Point;
  contentAtMid: Point;
};
type Gesture = PanGesture | PinchGesture | null;

const RENDER_SCALE = 1.6;
const PAD_X = 16 * 2;

export function PdfCanvasViewer(props: PdfCanvasViewerProps) {
  const { data, onPageNumberChange } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const renderViewportByPageRef = useRef<Array<{ width: number; height: number } | null>>([]);
  const pointersRef = useRef<Map<number, Point>>(new Map());
  const gestureRef = useRef<Gesture>(null);
  const didInitialCenterRef = useRef(false);

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [layoutReady, setLayoutReady] = useState(false);
  const [viewScale, setViewScale] = useState(1.25);
  const [docLoading, setDocLoading] = useState(false);
  const [hasRenderedOnce, setHasRenderedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pan, setPan] = useState<Point>({ x: 0, y: INITIAL_TOP_MARGIN });
  const [isInteracting, setIsInteracting] = useState(false);

  const showLoadingOverlay = docLoading || !layoutReady || !hasRenderedOnce;

  const ratio = viewScale / RENDER_SCALE;
  const gridSizePx = Math.max(10, Math.round(40 * ratio));
  const gridDotColor = hexToRgba(props.accentColor, 0.32) ?? 'rgba(0,0,0,0.18)';
  const dotRadiusPx = clamp(1.5 * ratio, 0.6, 6);

  const viewScaleRef = useRef(viewScale);
  const panRef = useRef(pan);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<{ viewScale?: number; pan?: Point }>({});

  useEffect(() => {
    viewScaleRef.current = viewScale;
  }, [viewScale]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const flush = useCallback(() => {
    rafRef.current = null;
    const pending = pendingRef.current;
    pendingRef.current = {};
    if (pending.viewScale !== undefined) setViewScale(pending.viewScale);
    if (pending.pan) setPan(pending.pan);
  }, []);

  const schedule = useCallback(
    (next: { viewScale?: number; pan?: Point }) => {
      if (next.viewScale !== undefined) {
        viewScaleRef.current = next.viewScale;
        pendingRef.current.viewScale = next.viewScale;
      }
      if (next.pan) {
        panRef.current = next.pan;
        pendingRef.current.pan = next.pan;
      }
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(flush);
    },
    [flush],
  );

  useEffect(() => {
    let cancelled = false;
    const dataCopy = data.slice(0);
    const task = pdfjs.getDocument({ data: dataCopy });
    setDocLoading(true);
    setError(null);
    setNumPages(null);
    setDoc(null);
    setHasRenderedOnce(false);
    setLayoutReady(false);
    didInitialCenterRef.current = false;
    task.promise
      .then((doc) => {
        if (cancelled) return;
        setDoc(doc);
        setNumPages(doc.numPages);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'PDF Fehler');
      })
      .finally(() => {
        if (cancelled) return;
        setDocLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [data]);

  const pageNumbers = useMemo(() => {
    const n = numPages ?? 0;
    return Array.from({ length: n }, (_, idx) => idx + 1);
  }, [numPages]);

  useLayoutEffect(() => {
    let cancelled = false;
    async function run() {
      if (!doc || !numPages || layoutReady) return;
      const el = containerRef.current;
      if (!el) return;

      let maxW = 0;
      for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const vp = page.getViewport({ scale: RENDER_SCALE });
        if (vp.width > maxW) maxW = vp.width;
      }

      const contentW = PAD_X + maxW;
      const rect = el.getBoundingClientRect();
      setPan((p) => ({ x: (rect.width - contentW * ratio) / 2, y: p.y }));
      didInitialCenterRef.current = true;
      if (!cancelled) setLayoutReady(true);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [doc, numPages, layoutReady, ratio]);

  useLayoutEffect(() => {
    let cancelled = false;
    async function render() {
      if (!doc || !numPages || !layoutReady) return;
      setError(null);
      try {
        for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
          const canvas = canvasRefs.current[pageNumber - 1];
          if (!canvas) continue;
          const page = await doc.getPage(pageNumber);
          if (cancelled) return;
          const viewport = page.getViewport({ scale: RENDER_SCALE });
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas context missing');
          const dpr = window.devicePixelRatio || 1;
          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          renderViewportByPageRef.current[pageNumber - 1] = {
            width: viewport.width,
            height: viewport.height,
          };
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          const renderTask = page.render({ canvasContext: ctx, viewport, canvas });
          await renderTask.promise;
          if (cancelled) return;
        }
        if (!cancelled) setHasRenderedOnce(true);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'PDF Render Fehler');
      }
    }
    void render();
    return () => {
      cancelled = true;
    };
  }, [doc, numPages, layoutReady]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root || !numPages) return;
    const ratioByPage = new Map<number, number>();
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const page = Number((e.target as HTMLElement).dataset.page ?? '');
          if (!Number.isFinite(page)) continue;
          ratioByPage.set(page, e.isIntersecting ? e.intersectionRatio : 0);
        }
        let bestPage: number | null = null;
        let bestRatio = 0;
        for (const [page, r] of ratioByPage.entries()) {
          if (r > bestRatio) {
            bestRatio = r;
            bestPage = page;
          }
        }
        if (!bestPage) return;
        onPageNumberChange(bestPage);
      },
      { root, threshold: [0, 0.2, 0.4, 0.6, 0.8] },
    );
    for (const el of pageRefs.current) {
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, [numPages, onPageNumberChange]);

  const containerPoint = useMemo(
    () => (e: { clientX: number; clientY: number }) => {
      const el = containerRef.current;
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    [],
  );

  const contentPointFromContainerPoint = (p: Point) => {
    const nextRatio = viewScaleRef.current / RENDER_SCALE;
    const base = panRef.current;
    return {
      x: (p.x - base.x) / nextRatio,
      y: (p.y - base.y) / nextRatio,
    };
  };

  const panForFixedContentPoint = (
    content: Point,
    containerPt: Point,
    nextRatio: number,
  ): Point => ({
    x: containerPt.x - nextRatio * content.x,
    y: containerPt.y - nextRatio * content.y,
  });

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const isZoom = e.ctrlKey || e.altKey || e.metaKey;
    if (!isZoom) {
      const p = panRef.current;
      schedule({ pan: { x: p.x - e.deltaX, y: p.y - e.deltaY } });
      return;
    }
    const c = containerPoint(e);
    const content = contentPointFromContainerPoint(c);
    const intensity = e.ctrlKey ? 0.004 : 0.0028;
    const factor = Math.exp(-e.deltaY * intensity);
    const currentView = viewScaleRef.current;
    const nextView = clamp(currentView * factor, 0.6, 3.5);
    if (nextView === currentView) return;
    const nextRatio = nextView / RENDER_SCALE;
    schedule({ viewScale: nextView, pan: panForFixedContentPoint(content, c, nextRatio) });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, containerPoint(e));
    setIsInteracting(true);
    const pts = Array.from(pointersRef.current.values());
    if (pts.length === 1) {
      gestureRef.current = { kind: 'pan', startPan: panRef.current, startPointer: pts[0] };
    } else if (pts.length === 2) {
      const [a, b] = pts;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      gestureRef.current = {
        kind: 'pinch',
        startPan: panRef.current,
        startRatio: viewScaleRef.current / RENDER_SCALE,
        startDistance: Math.max(1, dist),
        startMid: mid,
        contentAtMid: contentPointFromContainerPoint(mid),
      };
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, containerPoint(e));
    const pts = Array.from(pointersRef.current.values());

    if (pts.length === 2) {
      const [a, b] = pts;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const g = gestureRef.current;
      if (!g || g.kind !== 'pinch') return;
      const nextRatio = clamp(
        g.startRatio * (dist / g.startDistance),
        0.6 / RENDER_SCALE,
        3.5 / RENDER_SCALE,
      );
      const nextView = clamp(nextRatio * RENDER_SCALE, 0.6, 3.5);
      schedule({
        viewScale: nextView,
        pan: panForFixedContentPoint(g.contentAtMid, mid, nextRatio),
      });
      return;
    }

    if (pts.length === 1) {
      const g = gestureRef.current;
      if (!g || g.kind !== 'pan') return;
      const p = pts[0];
      schedule({
        pan: {
          x: g.startPan.x + (p.x - g.startPointer.x),
          y: g.startPan.y + (p.y - g.startPointer.y),
        },
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size === 0) {
      setIsInteracting(false);
      gestureRef.current = null;
    } else if (pointersRef.current.size === 1) {
      const p = Array.from(pointersRef.current.values())[0];
      gestureRef.current = { kind: 'pan', startPan: panRef.current, startPointer: p };
    }
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // noop
    }
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size === 0) {
      setIsInteracting(false);
      gestureRef.current = null;
    }
  };

  return (
    <div className="h-full">
      {error ? (
        <div className="mb-3 rounded-md border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div
        ref={containerRef}
        className="relative h-full overflow-hidden"
        style={{
          touchAction: 'none',
          userSelect: 'none',
          cursor: isInteracting ? 'grabbing' : 'grab',
          backgroundImage: `radial-gradient(circle at 50% 50%, ${gridDotColor} ${dotRadiusPx}px, transparent 0)`,
          backgroundSize: `${gridSizePx}px ${gridSizePx}px`,
          backgroundPosition: `${Math.round(pan.x)}px ${Math.round(pan.y)}px`,
        }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {layoutReady ? (
          <div
            className="absolute left-0 top-0"
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${ratio})`,
              transformOrigin: '0 0',
              opacity: hasRenderedOnce ? 1 : 0,
              pointerEvents: hasRenderedOnce ? 'auto' : 'none',
            }}
          >
            <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-6">
              {pageNumbers.map((n) => (
                <div
                  key={n}
                  ref={(el) => {
                    pageRefs.current[n - 1] = el;
                  }}
                  data-page={n}
                  className="w-full"
                >
                  <div className="mx-auto w-fit rounded-md bg-white">
                    <canvas
                      ref={(el) => {
                        canvasRefs.current[n - 1] = el;
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {showLoadingOverlay ? (
          <div className="absolute inset-0 grid place-items-center">
            <div
              role="status"
              aria-label="Lädt"
              className="h-8 w-8 animate-spin rounded-full border-2 border-slate-400/60 border-t-transparent"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
