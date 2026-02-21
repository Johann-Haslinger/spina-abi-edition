import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { formatTaskPath } from '../features/session/utils/formatTaskPath';
import { newId } from '../lib/id';
import { attemptRepo, inkRepo } from '../repositories';
import { useInkActions } from './actions';
import { bboxContains, bboxExpand, bboxFromPoints, bboxUnion, dist2 } from './geometry';
import { inkMinDistWorld, toWorldPoint, useInkStore } from './inkStore';
import { useInkHydrate } from './persist';
import { drawStrokeFill } from './stroke';
import type { InkBrush, InkPoint, InkStroke } from './types';

type Point = { x: number; y: number };

function isProbablyIpad() {
  const ua = navigator.userAgent || '';
  const platform = (navigator.platform || '').toLowerCase();
  const maxTouch = navigator.maxTouchPoints || 0;
  return /ipad/i.test(ua) || (platform.includes('mac') && maxTouch > 1);
}

export function InkOverlay(props: {
  studySessionId: string;
  assetId: string;
  activeAttemptId: string | null;
  pan: Point;
  ratio: number;
}) {
  const hydrateCtx = useMemo(
    () => ({ studySessionId: props.studySessionId, assetId: props.assetId }),
    [props.studySessionId, props.assetId],
  );
  useInkHydrate(hydrateCtx);

  const setActiveAttemptId = useInkStore((s) => s.setActiveAttemptId);
  const strokes = useInkStore((s) => s.strokes);
  const brush = useInkStore((s) => s.brush);
  const pencilColor = useInkStore((s) => s.pencilColor);
  const markerColor = useInkStore((s) => s.markerColor);
  const colorForTool = (tool: string) => (tool === 'marker' ? markerColor : pencilColor);
  const opacity = useInkStore((s) => s.opacity);
  const baseSize = useInkStore((s) => s.baseSize);
  const selectedAttemptId = useInkStore((s) => s.selectedAttemptId);
  const selectedStrokeIds = useInkStore((s) => s.selectedStrokeIds);
  const setSelectedAttemptId = useInkStore((s) => s.setSelectedAttemptId);
  const setSelectedStrokeIds = useInkStore((s) => s.setSelectedStrokeIds);
  const clearSelection = useInkStore((s) => s.clearSelection);
  const applyTranslation = useInkStore((s) => s.applyTranslation);
  const applyTranslationStrokes = useInkStore((s) => s.applyTranslationStrokes);
  const pushCommand = useInkStore((s) => s.pushCommand);

  const { commitStroke, deleteStrokes } = useInkActions();

  useEffect(() => {
    setActiveAttemptId(props.activeAttemptId);
    if (!props.activeAttemptId) clearSelection();
  }, [props.activeAttemptId, setActiveAttemptId, clearSelection]);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const mainRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const dpr = window.devicePixelRatio || 1;

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [attemptMetaById, setAttemptMetaById] = useState<Record<string, string>>({});
  const [visualNonce, setVisualNonce] = useState(0);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(1, Math.floor(r.width)), h: Math.max(1, Math.floor(r.height)) });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setSize({ w: Math.max(1, Math.floor(r.width)), h: Math.max(1, Math.floor(r.height)) });
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    for (const c of [mainRef.current, overlayRef.current]) {
      if (!c) continue;
      c.width = Math.floor(size.w * dpr);
      c.height = Math.floor(size.h * dpr);
      c.style.width = `${size.w}px`;
      c.style.height = `${size.h}px`;
    }
  }, [size.w, size.h, dpr]);

  const viewport = { pan: props.pan, ratio: props.ratio };

  const selectionBBox = useMemo(() => {
    if (selectedStrokeIds.length > 0) {
      const selected = strokes.filter((s) => selectedStrokeIds.includes(s.id));
      if (selected.length === 0) return null;
      const bbox = selected.map((s) => s.bbox).reduce((acc, b) => bboxUnion(acc, b));
      return { strokeIds: selectedStrokeIds, bbox };
    }
    if (!selectedAttemptId) return null;
    const selected = strokes.filter((s) => s.attemptId === selectedAttemptId);
    if (selected.length === 0) return null;
    const bbox = selected.map((s) => s.bbox).reduce((acc, b) => bboxUnion(acc, b));
    return { attemptId: selectedAttemptId, bbox };
  }, [selectedAttemptId, selectedStrokeIds, strokes]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!props.studySessionId || !props.assetId) return;
      const rows = await attemptRepo.listForSessionAsset({
        studySessionId: props.studySessionId,
        assetId: props.assetId,
      });
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const r of rows) {
        next[r.attempt.id] = `Aufgabe ${formatTaskPath({
          problemIdx: r.problemIdx,
          subproblemLabel: r.subproblemLabel,
          subsubproblemLabel: r.subsubproblemLabel,
        })}`;
      }
      setAttemptMetaById(next);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [props.studySessionId, props.assetId, props.activeAttemptId]);

  const otherAttemptBoxes = useMemo(() => {
    const active = props.activeAttemptId;
    const byAttempt = new Map<string, { bbox: InkStroke['bbox']; lastCreatedAtMs: number }>();
    for (const s of strokes) {
      if (!s.attemptId || s.attemptId === active) continue;
      const entry = byAttempt.get(s.attemptId);
      if (!entry) {
        byAttempt.set(s.attemptId, { bbox: s.bbox, lastCreatedAtMs: s.createdAtMs });
      } else {
        entry.bbox = bboxUnion(entry.bbox, s.bbox);
        entry.lastCreatedAtMs = Math.max(entry.lastCreatedAtMs, s.createdAtMs);
      }
    }
    const paddingWorld = 18 / Math.max(0.0001, props.ratio);
    const out = Array.from(byAttempt.entries()).map(([attemptId, v]) => ({
      attemptId,
      bbox: bboxExpand(v.bbox, paddingWorld),
      lastCreatedAtMs: v.lastCreatedAtMs,
    }));
    out.sort((a, b) => a.lastCreatedAtMs - b.lastCreatedAtMs);
    return out;
  }, [strokes, props.activeAttemptId, props.ratio]);

  const redrawMain = useRef(0);
  useEffect(() => {
    const canvas = mainRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (redrawMain.current) cancelAnimationFrame(redrawMain.current);
    redrawMain.current = requestAnimationFrame(() => {
      redrawMain.current = 0;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const sx = dpr * viewport.ratio;
      ctx.setTransform(sx, 0, 0, sx, dpr * viewport.pan.x, dpr * viewport.pan.y);

      // Background “cards” for other attempts (behind their ink)
      const fontSizeWorld = 11 / Math.max(0.0001, viewport.ratio);
      const labelPadWorld = 6 / Math.max(0.0001, viewport.ratio);
      for (const box of otherAttemptBoxes) {
        const b = box.bbox;
        const dragStrokeIds = penRef.current.dragStrokeIds;
        const isMoveActive =
          isProbablyIpad() &&
          penRef.current.mode === 'drag' &&
          (box.attemptId === selectedAttemptId ||
            (dragStrokeIds?.length &&
              strokes.some((s) => s.attemptId === box.attemptId && dragStrokeIds.includes(s.id))));

        ctx.save();
        if (isMoveActive) {
          ctx.shadowColor = 'rgba(0,0,0,0.25)';
          ctx.shadowBlur = 14 / Math.max(0.0001, viewport.ratio);
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 6 / Math.max(0.0001, viewport.ratio);
        }
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
        ctx.shadowColor = 'transparent';
        ctx.restore();

        const label = attemptMetaById[box.attemptId] ?? 'Aufgabe';
        ctx.save();
        ctx.font = `${fontSizeWorld}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`;
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.textBaseline = 'top';
        ctx.fillText(label, b.minX + labelPadWorld, b.minY + labelPadWorld);
        ctx.restore();
      }

      for (const s of strokes) {
        drawStrokeFill(ctx, s);
      }
    });

    return () => {
      if (redrawMain.current) cancelAnimationFrame(redrawMain.current);
    };
  }, [
    strokes,
    viewport.pan.x,
    viewport.pan.y,
    viewport.ratio,
    dpr,
    otherAttemptBoxes,
    attemptMetaById,
    selectedAttemptId,
    visualNonce,
  ]);

  const penRef = useRef<{
    mode: 'draw' | 'erase' | 'hold' | 'drag' | 'lasso' | null;
    pointerId: number | null;
    points: InkPoint[];
    lastPt: Point | null;
    drawTool: Exclude<InkBrush, 'eraser' | 'select'> | null;
    eraserWorldRadius: number;
    dragAttemptId: string | null;
    dragStrokeIds: string[] | null;
    dragTotal: Point;
    dragLast: Point | null;
    holdTimer: number | null;
    holdStartWorld: Point | null;
    lassoPts: Point[];
  }>({
    mode: null,
    pointerId: null,
    points: [],
    lastPt: null,
    drawTool: null,
    eraserWorldRadius: 8,
    dragAttemptId: null,
    dragStrokeIds: null,
    dragTotal: { x: 0, y: 0 },
    dragLast: null,
    holdTimer: null,
    holdStartWorld: null,
    lassoPts: [],
  });

  const containerPoint = (e: { clientX: number; clientY: number }): Point => {
    const el = wrapRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const eraseAt = async (world: Point) => {
    const attemptId = props.activeAttemptId;
    if (!attemptId) return;

    const radiusWorld = Math.max(3, penRef.current.eraserWorldRadius);
    const hit: InkStroke[] = [];
    const expanded = (s: InkStroke) => bboxExpand(s.bbox, radiusWorld + s.baseSize * 4);

    for (let i = strokes.length - 1; i >= 0; i--) {
      const s = strokes[i]!;
      if (s.attemptId !== attemptId) continue;
      const b = expanded(s);
      if (!bboxContains(b, world.x, world.y)) continue;
      const r2 = radiusWorld * radiusWorld;
      for (const [x, y] of s.points) {
        if (dist2(x, y, world.x, world.y) <= r2) {
          hit.push(s);
          break;
        }
      }
      if (hit.length) break;
    }

    if (hit.length) await deleteStrokes(hit);
  };

  const hitTestOtherAttempt = (world: Point) => {
    // Hit the permanent background boxes (more usable than point-distance)
    for (let i = otherAttemptBoxes.length - 1; i >= 0; i--) {
      const box = otherAttemptBoxes[i]!;
      if (bboxContains(box.bbox, world.x, world.y)) return box.attemptId;
    }
    return null;
  };

  const redrawOverlay = useRef(0);
  const drawOverlay = (worldCursor?: Point) => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const sx = dpr * viewport.ratio;
    ctx.setTransform(sx, 0, 0, sx, dpr * viewport.pan.x, dpr * viewport.pan.y);

    if (penRef.current.mode === 'draw' && penRef.current.points.length >= 2) {
      const tool = penRef.current.drawTool ?? 'pencil';
      drawStrokeFill(ctx, {
        points: penRef.current.points,
        tool,
        baseSize,
        color: colorForTool(tool),
        opacity,
      });
    }

    if (penRef.current.mode === 'lasso' && penRef.current.lassoPts.length >= 2) {
      const pts = penRef.current.lassoPts;
      ctx.save();
      ctx.lineWidth = 2 / Math.max(0.0001, viewport.ratio);
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.setLineDash([6 / Math.max(0.0001, viewport.ratio), 6 / Math.max(0.0001, viewport.ratio)]);
      ctx.beginPath();
      ctx.moveTo(pts[0]!.x, pts[0]!.y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
      ctx.stroke();
      ctx.restore();
    }

    if (penRef.current.mode === 'erase' && worldCursor) {
      const r = penRef.current.eraserWorldRadius;
      ctx.save();
      ctx.lineWidth = 1.5 / Math.max(0.0001, viewport.ratio);
      ctx.strokeStyle = 'rgba(15,23,42,0.75)';
      ctx.beginPath();
      ctx.arc(worldCursor.x, worldCursor.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (selectionBBox) {
      const b = selectionBBox.bbox;
      const pad = 6 / Math.max(0.0001, viewport.ratio);
      ctx.save();
      ctx.lineWidth = 1.5 / Math.max(0.0001, viewport.ratio);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.setLineDash([6 / Math.max(0.0001, viewport.ratio), 6 / Math.max(0.0001, viewport.ratio)]);
      ctx.strokeRect(
        b.minX - pad,
        b.minY - pad,
        b.maxX - b.minX + pad * 2,
        b.maxY - b.minY + pad * 2,
      );
      ctx.restore();
    }
  };

  useEffect(() => {
    if (redrawOverlay.current) cancelAnimationFrame(redrawOverlay.current);
    redrawOverlay.current = requestAnimationFrame(() => drawOverlay());
    return () => {
      if (redrawOverlay.current) cancelAnimationFrame(redrawOverlay.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    brush,
    baseSize,
    pencilColor,
    markerColor,
    opacity,
    selectedAttemptId,
    selectionBBox,
    viewport.pan.x,
    viewport.pan.y,
    viewport.ratio,
    strokes.length,
  ]);

  const bboxOverlaps = (a: InkStroke['bbox'], b: InkStroke['bbox']) =>
    a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;

  const polygonBBox = (pts: Point[]) => {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    return { minX, minY, maxX, maxY };
  };

  const pointInPolygon = (poly: Point[], p: Point) => {
    // Ray casting. Assumes poly is not self-intersecting (good enough for lasso).
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i]!;
      const b = poly[j]!;
      const intersect =
        a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y + 1e-12) + a.x;
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const onPointerDown = async (e: React.PointerEvent) => {
    const cpt = containerPoint(e);
    const world = toWorldPoint(cpt, props.pan, props.ratio);

    if (
      brush === 'select' &&
      selectionBBox &&
      !bboxContains(selectionBBox.bbox, world.x, world.y)
    ) {
      clearSelection();
      setVisualNonce((n) => n + 1);
    }

    if (e.pointerType === 'pen') {
      if (!props.activeAttemptId) return;
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

      if (brush === 'select') {
        if (selectionBBox && bboxContains(selectionBBox.bbox, world.x, world.y)) {
          penRef.current.mode = 'drag';
          penRef.current.pointerId = e.pointerId;
          if ('strokeIds' in selectionBBox && selectionBBox.strokeIds) {
            penRef.current.dragStrokeIds = selectionBBox.strokeIds;
            penRef.current.dragAttemptId = null;
          } else {
            penRef.current.dragStrokeIds = null;
            penRef.current.dragAttemptId = selectionBBox.attemptId ?? null;
          }
          penRef.current.dragLast = world;
          penRef.current.dragTotal = { x: 0, y: 0 };
          setVisualNonce((n) => n + 1);
          return;
        }

        penRef.current.mode = 'lasso';
        penRef.current.pointerId = e.pointerId;
        penRef.current.lassoPts = [world];
        penRef.current.lastPt = world;
        if (redrawOverlay.current) cancelAnimationFrame(redrawOverlay.current);
        redrawOverlay.current = requestAnimationFrame(() => drawOverlay());
        return;
      }

      if (brush === 'eraser') {
        penRef.current.mode = 'erase';
        penRef.current.pointerId = e.pointerId;
        penRef.current.eraserWorldRadius = Math.max(6, 12 / Math.max(0.0001, props.ratio));
        await eraseAt(world);
        if (redrawOverlay.current) cancelAnimationFrame(redrawOverlay.current);
        redrawOverlay.current = requestAnimationFrame(() => drawOverlay(world));
        return;
      }

      penRef.current.mode = 'draw';
      penRef.current.pointerId = e.pointerId;
      penRef.current.drawTool = brush;
      penRef.current.points = [[world.x, world.y, e.pressure || 0.5, Date.now()]];
      penRef.current.lastPt = world;
      if (redrawOverlay.current) cancelAnimationFrame(redrawOverlay.current);
      redrawOverlay.current = requestAnimationFrame(() => drawOverlay());
      return;
    }

    if (brush === 'select' && selectionBBox && bboxContains(selectionBBox.bbox, world.x, world.y)) {
      penRef.current.mode = 'drag';
      penRef.current.pointerId = e.pointerId;
      if ('strokeIds' in selectionBBox && selectionBBox.strokeIds) {
        penRef.current.dragStrokeIds = selectionBBox.strokeIds;
        penRef.current.dragAttemptId = null;
      } else {
        penRef.current.dragStrokeIds = null;
        penRef.current.dragAttemptId = selectionBBox.attemptId ?? null;
      }
      penRef.current.dragLast = world;
      penRef.current.dragTotal = { x: 0, y: 0 };
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setVisualNonce((n) => n + 1);
      return;
    }

    const hitAttemptId = hitTestOtherAttempt(world);
    if (!hitAttemptId) return;
    setSelectedAttemptId(hitAttemptId);

    // iPad: move only after long-press.
    if (isProbablyIpad()) {
      penRef.current.mode = 'hold';
      penRef.current.pointerId = e.pointerId;
      penRef.current.dragAttemptId = hitAttemptId;
      penRef.current.dragLast = world;
      penRef.current.dragTotal = { x: 0, y: 0 };
      penRef.current.holdStartWorld = world;
      if (penRef.current.holdTimer) window.clearTimeout(penRef.current.holdTimer);
      penRef.current.holdTimer = window.setTimeout(() => {
        if (penRef.current.mode !== 'hold' || penRef.current.dragAttemptId !== hitAttemptId) return;
        penRef.current.mode = 'drag';
        setVisualNonce((n) => n + 1);
      }, 280);

      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    penRef.current.mode = 'drag';
    penRef.current.pointerId = e.pointerId;
    penRef.current.dragAttemptId = hitAttemptId;
    penRef.current.dragLast = world;
    penRef.current.dragTotal = { x: 0, y: 0 };
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = async (e: React.PointerEvent) => {
    const st = penRef.current;
    if (st.pointerId !== e.pointerId) return;

    const world = toWorldPoint(containerPoint(e), props.pan, props.ratio);

    if (st.mode === 'erase') {
      e.preventDefault();
      e.stopPropagation();
      await eraseAt(world);
      if (redrawOverlay.current) cancelAnimationFrame(redrawOverlay.current);
      redrawOverlay.current = requestAnimationFrame(() => drawOverlay(world));
      return;
    }

    if (st.mode === 'draw') {
      e.preventDefault();
      e.stopPropagation();

      const last = st.lastPt;
      if (!last) return;

      const minDist = inkMinDistWorld(0.6, props.ratio);
      if (dist2(last.x, last.y, world.x, world.y) < minDist * minDist) return;

      st.points.push([world.x, world.y, e.pressure || 0.5, Date.now()]);
      st.lastPt = world;

      if (redrawOverlay.current) cancelAnimationFrame(redrawOverlay.current);
      redrawOverlay.current = requestAnimationFrame(() => drawOverlay());
      return;
    }

    if (st.mode === 'lasso') {
      e.preventDefault();
      e.stopPropagation();
      const last = st.lastPt;
      if (!last) return;
      const minDist = inkMinDistWorld(0.8, props.ratio);
      if (dist2(last.x, last.y, world.x, world.y) < minDist * minDist) return;
      st.lassoPts.push(world);
      st.lastPt = world;
      if (redrawOverlay.current) cancelAnimationFrame(redrawOverlay.current);
      redrawOverlay.current = requestAnimationFrame(() => drawOverlay());
      return;
    }

    if (st.mode === 'hold') {
      e.preventDefault();
      e.stopPropagation();
      const start = st.holdStartWorld;
      if (start) {
        const moved2 = dist2(start.x, start.y, world.x, world.y);
        const thresh = (6 / Math.max(0.0001, props.ratio)) ** 2;
        if (moved2 > thresh) {
          if (st.holdTimer) window.clearTimeout(st.holdTimer);
          st.holdTimer = null;
          st.mode = null; // just selection, no move
          setVisualNonce((n) => n + 1);
        }
      }
      return;
    }

    if (st.mode === 'drag' && st.dragLast) {
      e.preventDefault();
      e.stopPropagation();
      const dx = world.x - st.dragLast.x;
      const dy = world.y - st.dragLast.y;
      st.dragLast = world;
      st.dragTotal = { x: st.dragTotal.x + dx, y: st.dragTotal.y + dy };
      if (st.dragStrokeIds?.length) {
        applyTranslationStrokes({ strokeIds: st.dragStrokeIds, dx, dy });
      } else if (st.dragAttemptId) {
        applyTranslation({ attemptId: st.dragAttemptId, dx, dy });
      }
      return;
    }
  };

  const onPointerUp = async (e: React.PointerEvent) => {
    const st = penRef.current;
    if (st.pointerId !== e.pointerId) return;

    const world = toWorldPoint(containerPoint(e), props.pan, props.ratio);

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // noop
    }

    if (st.mode === 'draw') {
      e.preventDefault();
      e.stopPropagation();

      const pts = st.points;
      const tool = st.drawTool;
      st.mode = null;
      st.pointerId = null;
      st.points = [];
      st.lastPt = null;
      st.drawTool = null;

      if (!props.activeAttemptId || pts.length < 2) {
        if (redrawOverlay.current) cancelAnimationFrame(redrawOverlay.current);
        redrawOverlay.current = requestAnimationFrame(() => drawOverlay());
        return;
      }

      const now = Date.now();
      const stroke: InkStroke = {
        id: newId(),
        studySessionId: props.studySessionId,
        assetId: props.assetId,
        attemptId: props.activeAttemptId,
        createdAtMs: now,
        updatedAtMs: now,
        tool: tool ?? 'pencil',
        color: colorForTool(tool ?? 'pencil'),
        opacity,
        baseSize,
        points: pts,
        bbox: bboxFromPoints(pts),
      };

      await commitStroke(stroke);
      if (redrawOverlay.current) cancelAnimationFrame(redrawOverlay.current);
      redrawOverlay.current = requestAnimationFrame(() => drawOverlay());
      return;
    }

    if (st.mode === 'erase') {
      e.preventDefault();
      e.stopPropagation();
      st.mode = null;
      st.pointerId = null;
      if (redrawOverlay.current) cancelAnimationFrame(redrawOverlay.current);
      redrawOverlay.current = requestAnimationFrame(() => drawOverlay());
      return;
    }

    if (st.mode === 'lasso') {
      e.preventDefault();
      e.stopPropagation();

      const lasso = st.lassoPts.slice();
      st.mode = null;
      st.pointerId = null;
      st.lassoPts = [];
      st.lastPt = null;

      if (lasso.length < 3) {
        const hitStroke = [...strokes]
          .reverse()
          .find((s) => bboxContains(s.bbox, world.x, world.y));
        if (hitStroke) setSelectedStrokeIds([hitStroke.id]);
        else clearSelection();
        if (redrawOverlay.current) cancelAnimationFrame(redrawOverlay.current);
        redrawOverlay.current = requestAnimationFrame(() => drawOverlay());
        return;
      }

      const lassoB = polygonBBox(lasso);
      const enclosedIds: string[] = [];
      for (const s of strokes) {
        if (!bboxOverlaps(s.bbox, lassoB)) continue;
        for (const [x, y] of s.points) {
          if (pointInPolygon(lasso, { x, y })) {
            enclosedIds.push(s.id);
            break;
          }
        }
      }
      if (enclosedIds.length > 0) setSelectedStrokeIds(enclosedIds);
      else clearSelection();

      if (redrawOverlay.current) cancelAnimationFrame(redrawOverlay.current);
      redrawOverlay.current = requestAnimationFrame(() => drawOverlay());
      return;
    }

    if (st.mode === 'hold') {
      e.preventDefault();
      e.stopPropagation();
      if (st.holdTimer) window.clearTimeout(st.holdTimer);
      st.holdTimer = null;
      st.mode = null;
      st.pointerId = null;
      st.dragAttemptId = null;
      st.dragLast = null;
      st.dragTotal = { x: 0, y: 0 };
      st.holdStartWorld = null;
      setVisualNonce((n) => n + 1);
      return;
    }

    if (st.mode === 'drag') {
      e.preventDefault();
      e.stopPropagation();
      if (st.holdTimer) window.clearTimeout(st.holdTimer);
      st.holdTimer = null;
      const strokeIds = st.dragStrokeIds;
      const attemptId = st.dragAttemptId;
      const total = st.dragTotal;
      st.mode = null;
      st.pointerId = null;
      st.dragAttemptId = null;
      st.dragStrokeIds = null;
      st.dragLast = null;
      st.dragTotal = { x: 0, y: 0 };
      st.holdStartWorld = null;
      setVisualNonce((n) => n + 1);

      if (total.x || total.y) {
        if (strokeIds?.length) {
          await inkRepo.translateStrokes({ strokeIds, dx: total.x, dy: total.y });
          pushCommand({ kind: 'translateStrokes', strokeIds, dx: total.x, dy: total.y });
        } else if (attemptId) {
          await inkRepo.translateAttempt({ attemptId, dx: total.x, dy: total.y });
          pushCommand({ kind: 'translateAttempt', attemptId, dx: total.x, dy: total.y });
        }
      }
      return;
    }
  };

  const onPointerCancel = (e: React.PointerEvent) => {
    if (penRef.current.pointerId !== e.pointerId) return;
    if (penRef.current.holdTimer) window.clearTimeout(penRef.current.holdTimer);
    penRef.current.mode = null;
    penRef.current.pointerId = null;
    penRef.current.points = [];
    penRef.current.lastPt = null;
    penRef.current.drawTool = null;
    penRef.current.dragAttemptId = null;
    penRef.current.dragStrokeIds = null;
    penRef.current.dragLast = null;
    penRef.current.dragTotal = { x: 0, y: 0 };
    penRef.current.holdTimer = null;
    penRef.current.holdStartWorld = null;
    penRef.current.lassoPts = [];
    setVisualNonce((n) => n + 1);
  };

  const show = true;
  if (!show) return null;

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0"
      style={{
        touchAction: 'none',
        userSelect: 'none',
        pointerEvents: 'auto',
        cursor: isProbablyIpad()
          ? 'default'
          : brush === 'select'
          ? 'grab'
          : brush === 'eraser'
          ? 'crosshair'
          : 'crosshair',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onDoubleClick={() => {
        clearSelection();
      }}
    >
      <canvas ref={mainRef} className="absolute inset-0" />
      <canvas ref={overlayRef} className="absolute inset-0" />
    </div>
  );
}
