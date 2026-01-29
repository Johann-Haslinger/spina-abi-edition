import { useEffect, useRef, useState } from 'react';

type Point = { x: number; y: number };

export function ImagePanZoomViewer(props: { src: string; alt: string; accentColor?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [isInteracting, setIsInteracting] = useState(false);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const didInitRef = useRef(false);

  const gridSizePx = Math.max(10, Math.round(34 * scale));
  const gridDotColor = hexToRgba(props.accentColor, 0.32) ?? 'rgba(0,0,0,0.18)';

  const pointersRef = useRef<Map<number, Point>>(new Map());
  const gestureRef = useRef<
    | null
    | { kind: 'pan'; startPan: Point; startPointer: Point }
    | {
        kind: 'pinch';
        startScale: number;
        startDistance: number;
        contentAtMid: Point;
        startMid: Point;
      }
  >(null);

  function containerPoint(e: { clientX: number; clientY: number }): Point {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function contentPointFromContainerPoint(p: Point): Point {
    return { x: (p.x - pan.x) / scale, y: (p.y - pan.y) / scale };
  }

  function setPanToKeepContentPointFixed(content: Point, containerPt: Point, nextScale: number) {
    setPan({ x: containerPt.x - nextScale * content.x, y: containerPt.y - nextScale * content.y });
  }

  useEffect(() => {
    function tryInit() {
      if (didInitRef.current) return;
      const el = containerRef.current;
      const img = imgRef.current;
      if (!el || !img) return;
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      if (!iw || !ih) return;
      const rect = el.getBoundingClientRect();
      const fit = Math.min(rect.width / iw, rect.height / ih) * 0.98;
      const nextScale = clamp(fit, 0.2, 6);
      const nextPan = {
        x: (rect.width - iw * nextScale) / 2,
        y: (rect.height - ih * nextScale) / 2,
      };
      setScale(nextScale);
      setPan(nextPan);
      didInitRef.current = true;
    }
    tryInit();
    window.addEventListener('resize', tryInit);
    return () => window.removeEventListener('resize', tryInit);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative h-full overflow-hidden"
      style={{
        touchAction: 'none',
        userSelect: 'none',
        cursor: isInteracting ? 'grabbing' : 'grab',
        backgroundImage: `radial-gradient(circle at 1px 1px, ${gridDotColor} 1px, transparent 0)`,
        backgroundSize: `${gridSizePx}px ${gridSizePx}px`,
        backgroundPosition: `${Math.round(pan.x)}px ${Math.round(pan.y)}px`,
      }}
      onWheel={(e) => {
        e.preventDefault();
        const isZoom = e.ctrlKey || e.altKey || e.metaKey;
        if (!isZoom) {
          setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
          return;
        }
        const c = containerPoint(e);
        const content = contentPointFromContainerPoint(c);
        const intensity = e.ctrlKey ? 0.004 : 0.0028;
        const factor = Math.exp(-e.deltaY * intensity);
        const nextScale = clamp(scale * factor, 0.2, 6);
        if (nextScale === scale) return;
        setScale(nextScale);
        setPanToKeepContentPointFixed(content, c, nextScale);
      }}
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        pointersRef.current.set(e.pointerId, containerPoint(e));
        setIsInteracting(true);

        const pts = Array.from(pointersRef.current.values());
        if (pts.length === 1) {
          gestureRef.current = { kind: 'pan', startPan: pan, startPointer: pts[0] };
        } else if (pts.length === 2) {
          const [a, b] = pts;
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          const dist = Math.hypot(b.x - a.x, b.y - a.y);
          const contentAtMid = contentPointFromContainerPoint(mid);
          gestureRef.current = {
            kind: 'pinch',
            startScale: scale,
            startDistance: Math.max(1, dist),
            startMid: mid,
            contentAtMid,
          };
        }
      }}
      onPointerMove={(e) => {
        if (!pointersRef.current.has(e.pointerId)) return;
        pointersRef.current.set(e.pointerId, containerPoint(e));
        const pts = Array.from(pointersRef.current.values());

        if (pts.length === 2) {
          const [a, b] = pts;
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          const dist = Math.hypot(b.x - a.x, b.y - a.y);
          const g = gestureRef.current;
          if (!g || g.kind !== 'pinch') return;
          const nextScale = clamp(g.startScale * (dist / g.startDistance), 0.2, 6);
          setScale(nextScale);
          setPanToKeepContentPointFixed(g.contentAtMid, mid, nextScale);
          return;
        }

        if (pts.length === 1) {
          const g = gestureRef.current;
          if (!g || g.kind !== 'pan') return;
          const p = pts[0];
          setPan({
            x: g.startPan.x + (p.x - g.startPointer.x),
            y: g.startPan.y + (p.y - g.startPointer.y),
          });
        }
      }}
      onPointerUp={(e) => {
        pointersRef.current.delete(e.pointerId);
        if (pointersRef.current.size === 0) {
          setIsInteracting(false);
          gestureRef.current = null;
        } else if (pointersRef.current.size === 1) {
          const p = Array.from(pointersRef.current.values())[0];
          gestureRef.current = { kind: 'pan', startPan: pan, startPointer: p };
        }
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }}
      onPointerCancel={(e) => {
        pointersRef.current.delete(e.pointerId);
        if (pointersRef.current.size === 0) {
          setIsInteracting(false);
          gestureRef.current = null;
        }
      }}
    >
      <img
        ref={imgRef}
        src={props.src}
        alt={props.alt}
        className="absolute left-0 top-0 max-w-none select-none"
        draggable={false}
        onLoad={() => {
          didInitRef.current = false;
          // trigger init logic
          const el = containerRef.current;
          const img = imgRef.current;
          if (!el || !img) return;
          const iw = img.naturalWidth;
          const ih = img.naturalHeight;
          if (!iw || !ih) return;
          const rect = el.getBoundingClientRect();
          const fit = Math.min(rect.width / iw, rect.height / ih) * 0.98;
          const nextScale = clamp(fit, 0.2, 6);
          setScale(nextScale);
          setPan({ x: (rect.width - iw * nextScale) / 2, y: (rect.height - ih * nextScale) / 2 });
          didInitRef.current = true;
        }}
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`,
          transformOrigin: '0 0',
        }}
      />
    </div>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function hexToRgba(hex: string | undefined, alpha: number) {
  if (!hex) return undefined;
  const raw = hex.trim().replace('#', '');
  if (raw.length !== 6) return undefined;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  if (![r, g, b].every((n) => Number.isFinite(n))) return undefined;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
