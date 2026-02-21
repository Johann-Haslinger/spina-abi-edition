import { create } from 'zustand';
import { bboxUnion } from './geometry';
import type { InkBrush, InkStroke } from './types';

type Point = { x: number; y: number };

type InkCommand =
  | { kind: 'add'; stroke: InkStroke }
  | { kind: 'delete'; strokes: InkStroke[] }
  | { kind: 'translateAttempt'; attemptId: string; dx: number; dy: number }
  | { kind: 'translateStrokes'; strokeIds: string[]; dx: number; dy: number };

type InkState = {
  context: { studySessionId: string; assetId: string } | null;
  strokes: InkStroke[];

  activeAttemptId: string | null;
  brush: InkBrush;
  pencilColor: string;
  markerColor: string;
  opacity: number;
  baseSize: number;

  selectedAttemptId: string | null;
  selectedStrokeIds: string[];

  undoStack: InkCommand[];
  redoStack: InkCommand[];

  setContext: (ctx: { studySessionId: string; assetId: string } | null) => void;
  setActiveAttemptId: (attemptId: string | null) => void;
  setBrush: (brush: InkBrush) => void;
  setColorForBrush: (brush: 'pencil' | 'marker', color: string) => void;
  setOpacity: (opacity: number) => void;
  setBaseSize: (size: number) => void;

  hydrate: (strokes: InkStroke[]) => void;

  exec: (cmd: InkCommand) => void;
  applyTranslation: (input: { attemptId: string; dx: number; dy: number }) => void;
  applyTranslationStrokes: (input: { strokeIds: string[]; dx: number; dy: number }) => void;
  pushCommand: (cmd: InkCommand) => void;
  undo: () => InkCommand | null;
  redo: () => InkCommand | null;

  clearSelection: () => void;
  setSelectedAttemptId: (attemptId: string | null) => void;
  setSelectedStrokeIds: (ids: string[]) => void;
  getSelectionBBox: () => {
    attemptId?: string;
    strokeIds?: string[];
    bbox: { minX: number; minY: number; maxX: number; maxY: number };
  } | null;
};

function applyCmd(strokes: InkStroke[], cmd: InkCommand): InkStroke[] {
  if (cmd.kind === 'add')
    return [...strokes, cmd.stroke].sort((a, b) => a.createdAtMs - b.createdAtMs);
  if (cmd.kind === 'delete') {
    const ids = new Set(cmd.strokes.map((s) => s.id));
    return strokes.filter((s) => !ids.has(s.id));
  }
  if (cmd.kind === 'translateAttempt') {
    const { attemptId, dx, dy } = cmd;
    return strokes.map((s) => {
      if (s.attemptId !== attemptId) return s;
      return {
        ...s,
        points: s.points.map(([x, y, p, t]) => [x + dx, y + dy, p, t]),
        bbox: {
          minX: s.bbox.minX + dx,
          minY: s.bbox.minY + dy,
          maxX: s.bbox.maxX + dx,
          maxY: s.bbox.maxY + dy,
        },
        updatedAtMs: Date.now(),
      };
    });
  }
  if (cmd.kind === 'translateStrokes') {
    const ids = new Set(cmd.strokeIds);
    const { dx, dy } = cmd;
    return strokes.map((s) => {
      if (!ids.has(s.id)) return s;
      return {
        ...s,
        points: s.points.map(([x, y, p, t]) => [x + dx, y + dy, p, t]),
        bbox: {
          minX: s.bbox.minX + dx,
          minY: s.bbox.minY + dy,
          maxX: s.bbox.maxX + dx,
          maxY: s.bbox.maxY + dy,
        },
        updatedAtMs: Date.now(),
      };
    });
  }
  return strokes;
}

function invertCmd(cmd: InkCommand): InkCommand {
  if (cmd.kind === 'add') return { kind: 'delete', strokes: [cmd.stroke] };
  if (cmd.kind === 'delete') return { kind: 'add', stroke: cmd.strokes[0]! };
  if (cmd.kind === 'translateAttempt')
    return { kind: 'translateAttempt', attemptId: cmd.attemptId, dx: -cmd.dx, dy: -cmd.dy };
  return {
    kind: 'translateStrokes',
    strokeIds: cmd.strokeIds,
    dx: -cmd.dx,
    dy: -cmd.dy,
  };
}

export const useInkStore = create<InkState>()((set, get) => ({
  context: null,
  strokes: [],

  activeAttemptId: null,
  brush: 'pencil',
  pencilColor: '#ffffff',
  markerColor: '#D79E00',
  opacity: 1,
  baseSize: 2.2,

  selectedAttemptId: null,
  selectedStrokeIds: [],

  undoStack: [],
  redoStack: [],

  setContext: (ctx) =>
    set(() => ({
      context: ctx,
      strokes: [],
      selectedAttemptId: null,
      selectedStrokeIds: [],
      undoStack: [],
      redoStack: [],
    })),

  setActiveAttemptId: (attemptId) => set({ activeAttemptId: attemptId }),
  setBrush: (brush) => set({ brush }),
  setColorForBrush: (brush, color) =>
    set(brush === 'pencil' ? { pencilColor: color } : { markerColor: color }),
  setOpacity: (opacity) => set({ opacity }),
  setBaseSize: (baseSize) => set({ baseSize }),

  hydrate: (strokes) =>
    set({ strokes: strokes.slice().sort((a, b) => a.createdAtMs - b.createdAtMs) }),

  exec: (cmd) =>
    set((s) => ({
      strokes: applyCmd(s.strokes, cmd),
      undoStack: [...s.undoStack, cmd],
      redoStack: [],
    })),

  applyTranslation: ({ attemptId, dx, dy }) =>
    set((s) => ({
      strokes: applyCmd(s.strokes, { kind: 'translateAttempt', attemptId, dx, dy }),
    })),

  applyTranslationStrokes: ({ strokeIds, dx, dy }) =>
    set((s) => ({
      strokes: applyCmd(s.strokes, { kind: 'translateStrokes', strokeIds, dx, dy }),
    })),

  pushCommand: (cmd) =>
    set((s) => ({
      undoStack: [...s.undoStack, cmd],
      redoStack: [],
    })),

  undo: () => {
    const { undoStack } = get();
    if (undoStack.length === 0) return null;
    const last = undoStack[undoStack.length - 1]!;

    if (last.kind === 'delete' && last.strokes.length > 1) {
      // Re-add all strokes
      set((s) => ({
        strokes: [...s.strokes, ...last.strokes].sort((a, b) => a.createdAtMs - b.createdAtMs),
        undoStack: s.undoStack.slice(0, -1),
        redoStack: [...s.redoStack, last],
      }));
      return last;
    }

    const inv =
      last.kind === 'delete' ? { kind: 'add' as const, stroke: last.strokes[0]! } : invertCmd(last);
    set((s) => ({
      strokes: applyCmd(s.strokes, inv),
      undoStack: s.undoStack.slice(0, -1),
      redoStack: [...s.redoStack, last],
    }));
    return last;
  },

  redo: () => {
    const { redoStack } = get();
    if (redoStack.length === 0) return null;
    const last = redoStack[redoStack.length - 1]!;
    set((s) => ({
      strokes: applyCmd(s.strokes, last),
      undoStack: [...s.undoStack, last],
      redoStack: s.redoStack.slice(0, -1),
    }));
    return last;
  },

  clearSelection: () => set({ selectedAttemptId: null, selectedStrokeIds: [] }),
  setSelectedAttemptId: (attemptId) => set({ selectedAttemptId: attemptId, selectedStrokeIds: [] }),
  setSelectedStrokeIds: (ids) => set({ selectedStrokeIds: ids, selectedAttemptId: null }),

  getSelectionBBox: () => {
    const { selectedAttemptId, selectedStrokeIds, strokes } = get();
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
  },
}));

export function inkMinDistWorld(minDistScreenPx: number, ratio: number) {
  return minDistScreenPx / Math.max(0.0001, ratio);
}

export function toWorldPoint(containerPt: Point, pan: Point, ratio: number): Point {
  return { x: (containerPt.x - pan.x) / ratio, y: (containerPt.y - pan.y) / ratio };
}
