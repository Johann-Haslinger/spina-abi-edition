import { useCallback, useEffect, useRef, useState } from 'react';
import { clamp, hexToRgba, INITIAL_TOP_MARGIN } from './viewerUtils';

type Point = { x: number; y: number };

type PanGesture = { kind: 'pan'; startPan: Point; startPointer: Point };
type PinchGesture = {
  kind: 'pinch';
  startScale: number;
  startDistance: number;
  contentAtMid: Point;
  startMid: Point;
};
type Gesture = PanGesture | PinchGesture | null;

export function ImagePanZoomViewer(props: { src: string; alt: string; accentColor?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const pointersRef = useRef<Map<number, Point>>(new Map());
  const gestureRef = useRef<Gesture>(null);
  const didInitRef = useRef(false);

  const [isInteracting, setIsInteracting] = useState(false);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: INITIAL_TOP_MARGIN });

  const gridSizePx = Math.max(10, Math.round(34 * scale));
  const gridDotColor = hexToRgba(props.accentColor, 0.32) ?? 'rgba(0,0,0,0.18)';
  const dotRadiusPx = clamp(1.5 * scale, 0.6, 6);

  const containerPoint = useCallback((e: { clientX: number; clientY: number }) => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const contentPointFromContainerPoint = useCallback(
    (p: Point) => ({ x: (p.x - pan.x) / scale, y: (p.y - pan.y) / scale }),
    [pan, scale],
  );

  const setPanToKeepContentPointFixed = useCallback(
    (content: Point, containerPt: Point, nextScale: number) => {
      setPan({ x: containerPt.x - nextScale * content.x, y: containerPt.y - nextScale * content.y });
    },
    [],
  );

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
        y: INITIAL_TOP_MARGIN,
      };
      setScale(nextScale);
      setPan(nextPan);
      didInitRef.current = true;
    }
    tryInit();
    window.addEventListener('resize', tryInit);
    return () => window.removeEventListener('resize', tryInit);
  }, []);

  const handleImageLoad = useCallback(() => {
    didInitRef.current = false;
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
    setPan({
      x: (rect.width - iw * nextScale) / 2,
      y: INITIAL_TOP_MARGIN,
    });
    didInitRef.current = true;
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
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
    },
    [scale, containerPoint, contentPointFromContainerPoint, setPanToKeepContentPointFixed],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
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
        gestureRef.current = {
          kind: 'pinch',
          startScale: scale,
          startDistance: Math.max(1, dist),
          startMid: mid,
          contentAtMid: contentPointFromContainerPoint(mid),
        };
      }
    },
    [pan, scale, containerPoint, contentPointFromContainerPoint],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
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
    },
    [containerPoint, setPanToKeepContentPointFixed],
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
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
      // noop
    }
  }, [pan]);

  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size === 0) {
      setIsInteracting(false);
      gestureRef.current = null;
    }
  }, []);

  return (
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
      <img
        ref={imgRef}
        src={props.src}
        alt={props.alt}
        className="absolute left-0 top-0 max-w-none select-none"
        draggable={false}
        onLoad={handleImageLoad}
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`,
          transformOrigin: '0 0',
        }}
      />
    </div>
  );
}
