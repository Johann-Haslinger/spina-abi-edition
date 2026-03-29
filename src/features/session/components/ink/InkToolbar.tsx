import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { Minimize2, Redo2, Undo2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { GhostButton } from '../../../../components/Button';
import { useInkActions } from '../../../../ink/actions';
import { useInkStore } from '../../../../ink/inkStore';

function isProbablyIpad() {
  const ua = navigator.userAgent || '';
  const platform = (navigator.platform || '').toLowerCase();
  const maxTouch = navigator.maxTouchPoints || 0;
  return /ipad/i.test(ua) || (platform.includes('mac') && maxTouch > 1);
}

const COLORS = ['#ffffff', '#0064D3', '#00AE27', '#D79E00', '#E00000', '#000000'] as const;

const MORPH_TRANSITION = {
  type: 'spring',
  stiffness: 520,
  damping: 42,
  mass: 0.85,
} as const;

function ToolPreview(props: {
  baseSrc: string;
  overlaySrc?: string;
  tintColor: string | null;
  tintOpacity?: number;
  sizeClassName?: string;
}) {
  const { baseSrc, overlaySrc, tintColor, tintOpacity = 1, sizeClassName = 'h-7 w-7' } = props;
  const topSrc = overlaySrc ?? baseSrc;

  if (!tintColor) {
    return (
      <img
        src={topSrc}
        alt=""
        className={`${sizeClassName} object-contain object-bottom`}
        aria-hidden
      />
    );
  }

  return (
    <div className={`relative ${sizeClassName}`} aria-hidden>
      <div
        className="absolute inset-0 h-full w-full"
        style={
          {
            backgroundColor: tintColor,
            opacity: tintOpacity,
            WebkitMaskImage: `url(${baseSrc})`,
            maskImage: `url(${baseSrc})`,
            WebkitMaskMode: 'luminance',
            maskMode: 'luminance',
            WebkitMaskSize: 'contain',
            maskSize: 'contain',
            WebkitMaskPosition: 'bottom center',
            maskPosition: 'bottom center',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
          } as React.CSSProperties
        }
      />
      <img
        src={topSrc}
        alt=""
        className="absolute inset-0 h-full w-full object-contain object-bottom"
        aria-hidden
      />
    </div>
  );
}

export function InkToolbar(props: {
  activeAttemptId: string | null;
  studyAiConversationKey?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const layout = useInkToolbarStudyAiLayout({
    studyAiConversationKey: props.studyAiConversationKey,
  });

  const brush = useInkStore((s) => s.brush);
  const setBrush = useInkStore((s) => s.setBrush);
  const pencilColor = useInkStore((s) => s.pencilColor);
  const markerColor = useInkStore((s) => s.markerColor);
  const setColorForBrush = useInkStore((s) => s.setColorForBrush);
  const undoStackLen = useInkStore((s) => s.undoStack.length);
  const redoStackLen = useInkStore((s) => s.redoStack.length);
  const selectedAttemptId = useInkStore((s) => s.selectedAttemptId);
  const toolButtons = useToolButtons();
  const { undoWithPersist, redoWithPersist } = useInkActions();

  const canEdit = props.activeAttemptId ?? selectedAttemptId;

  if (!isProbablyIpad()) return null;
  if (!canEdit) return null;

  const activeTool = toolButtons.find((t) => t.id === brush) ?? toolButtons[0]!;
  const activeTintColor =
    brush === 'pencil' ? pencilColor : brush === 'marker' ? markerColor : null;
  const activeTintOpacity = brush === 'marker' ? 0.9 : 1;

  return (
    <LayoutGroup id="ink-toolbar">
      <AnimatePresence initial={false} mode="popLayout">
        {open ? (
          <div
            key="open"
            className="fixed bottom-6 z-50 pointer-events-auto"
            style={{
              left: '50%',
              transform: `translateX(calc(-50% + ${layout.openCenterShiftPx}px))`,
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <motion.div
              layoutId="ink-toolbar-surface"
              transition={MORPH_TRANSITION}
              className="w-fit overflow-hidden rounded-full border px-6 shadow-lg backdrop-blur-xs dark:border-white/5"
              style={{ backgroundColor: 'var(--app-floating-bg)' }}
            >
              <motion.div
                key="content"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                className="flex items-stretch gap-6"
              >
                <div className="flex items-center py-4">
                  <GhostButton
                    icon={<Minimize2 className="size-5" />}
                    onClick={() => setOpen(false)}
                    className="text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 py-4">
                  {COLORS.map((c) => {
                    const activeColor =
                      brush === 'pencil' ? pencilColor : brush === 'marker' ? markerColor : null;
                    const isSelected = activeColor !== null && activeColor === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Farbe ${c}`}
                        onClick={() => {
                          if (brush === 'pencil') setColorForBrush('pencil', c);
                          else if (brush === 'marker') setColorForBrush('marker', c);
                        }}
                        className={`rounded-full outline-offset-1 ${
                          isSelected ? 'outline-2 size-6 m-0.5' : 'size-7'
                        }`}
                        style={{ background: c, outlineColor: c }}
                      />
                    );
                  })}
                </div>

                <div className="flex items-end gap-2">
                  {toolButtons.map((t) => {
                    const isActive = brush === t.id;
                    const tintColor =
                      t.id === 'pencil' ? pencilColor : t.id === 'marker' ? markerColor : null;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        aria-label={t.label}
                        onClick={() => setBrush(t.id)}
                        className="relative flex h-22 w-10 shrink-0 items-center justify-center overflow-hidden transition-all duration-200"
                      >
                        {tintColor ? (
                          <div
                            className={`absolute inset-0 transition-transform duration-200 ${
                              isActive ? 'translate-y-[2.5%]' : 'translate-y-[20%]'
                            }`}
                          >
                            <div
                              className="absolute inset-0 h-full backdrop-blur-xl w-full"
                              style={
                                {
                                  backgroundColor: tintColor,
                                  opacity: t.id === 'marker' ? 0.6 : 1,
                                  WebkitMaskImage: `url(${t.src})`,
                                  maskImage: `url(${t.src})`,
                                  WebkitMaskMode: 'luminance',
                                  maskMode: 'luminance',
                                  WebkitMaskSize: 'contain',
                                  maskSize: 'contain',
                                  WebkitMaskPosition: 'bottom center',
                                  maskPosition: 'bottom center',
                                  WebkitMaskRepeat: 'no-repeat',
                                  maskRepeat: 'no-repeat',
                                } as React.CSSProperties
                              }
                            />
                            <img
                              src={t.id === 'pencil' || t.id === 'marker' ? t.overlaySrc : t.src}
                              alt=""
                              className="absolute inset-0 h-full w-full object-contain object-bottom"
                              aria-hidden
                            />
                          </div>
                        ) : (
                          <img
                            src={t.src}
                            alt=""
                            className={`h-22 w-12 object-contain object-bottom transition-transform duration-200 ${
                              isActive ? 'translate-y-[2.5%]' : 'translate-y-[20%]'
                            }`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="ml-auto flex items-center gap-1 py-4">
                  <GhostButton
                    icon={<Undo2 className="size-5" />}
                    onClick={() => void undoWithPersist()}
                    disabled={undoStackLen === 0}
                    className="text-slate-100"
                  />
                  <GhostButton
                    icon={<Redo2 className="size-5" />}
                    onClick={() => void redoWithPersist()}
                    disabled={redoStackLen === 0}
                    className="text-slate-100"
                  />
                </div>
              </motion.div>
            </motion.div>
          </div>
        ) : (
          <div
            key="closed"
            className="fixed bottom-6 z-50 pointer-events-auto"
            style={{ left: layout.closedLeftPx }}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <motion.div
              layoutId="ink-toolbar-surface"
              transition={MORPH_TRANSITION}
              role="button"
              tabIndex={0}
              aria-label="Ink Toolbar öffnen"
              onClick={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setOpen(true);
                }
              }}
              className="flex size-18 items-center justify-center overflow-hidden rounded-full border border-white/5 shadow-xl backdrop-blur active:scale-[0.98]"
              style={{ backgroundColor: 'var(--app-floating-bg)' }}
            >
              <ToolPreview
                baseSrc={activeTool.src}
                overlaySrc={
                  activeTool.id === 'pencil' || activeTool.id === 'marker'
                    ? activeTool.overlaySrc
                    : undefined
                }
                tintColor={activeTintColor}
                tintOpacity={activeTintOpacity}
                sizeClassName="size-16 translate-y-2"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </LayoutGroup>
  );
}

function useToolButtons() {
  const toolButtons = useMemo(
    () =>
      [
        {
          id: 'pencil' as const,
          label: 'Pencil',
          src: '/ink/pencil.png',
          overlaySrc: '/ink/pencil-transparent.png',
        },
        {
          id: 'marker' as const,
          label: 'Marker',
          src: '/ink/marker.png',
          overlaySrc: '/ink/marker-transparent.png',
        },
        { id: 'eraser' as const, label: 'Eraser', src: '/ink/eraser.png' },
        { id: 'select' as const, label: 'Auswahl', src: '/ink/select.png' },
      ] as const,
    [],
  );

  useEffect(() => {
    const hrefs = toolButtons.map((t) => t.src);

    const links: HTMLLinkElement[] = [];
    for (const href of hrefs) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = href;
      document.head.appendChild(link);
      links.push(link);
    }

    hrefs.forEach((href) => {
      const img = new Image();
      img.src = href;
    });

    return () => {
      links.forEach((l) => l.remove());
    };
  }, [toolButtons]);

  return toolButtons;
}

import { useFloatingQuickLogPanelStore } from '../../stores/floatingQuickLogPanelStore';
import { useStudyAiChatStore, type StudyAiUiMode } from '../../stores/studyAiChatStore';

export type InkToolbarStudyAiLayoutConfig = {
  closedLeftFallbackPx: number;
  gapPx: number;

  buttonModeLeftInsetPx: number;
  buttonModeWidthPx: number;

  floatingModeLeftInsetPx: number;
  floatingModeWidthPx: number;

  openCenterShiftWhenStudyAiFloatingPx: number;
  openCenterShiftWhenQuickLogDetailsOrReviewPx: number;
};

const INK_TOOLBAR_STUDY_AI_LAYOUT_DEFAULTS: InkToolbarStudyAiLayoutConfig = {
  closedLeftFallbackPx: 24,
  gapPx: 12,

  buttonModeLeftInsetPx: 40,
  buttonModeWidthPx: 56,

  floatingModeLeftInsetPx: 24,
  floatingModeWidthPx: 360,

  openCenterShiftWhenStudyAiFloatingPx: 100,
  openCenterShiftWhenQuickLogDetailsOrReviewPx: -50,
};

function useInkToolbarStudyAiLayout(params: {
  studyAiConversationKey?: string | null;
  config?: Partial<InkToolbarStudyAiLayoutConfig>;
}): {
  studyAiMode: StudyAiUiMode | null;
  closedLeftPx: number;
  openCenterShiftPx: number;
} {
  const cfg = useMemo(
    () => ({ ...INK_TOOLBAR_STUDY_AI_LAYOUT_DEFAULTS, ...(params.config ?? {}) }),
    [params.config],
  );

  const mode = useStudyAiChatStore((s) => {
    const key = params.studyAiConversationKey;
    if (!key) return null;
    return s.uiByConversation[key]?.mode ?? 'button';
  });

  const quickLogView = useFloatingQuickLogPanelStore((s) => s.view);
  const quickLogShift =
    quickLogView === 'progressDetails' || quickLogView === 'review'
      ? cfg.openCenterShiftWhenQuickLogDetailsOrReviewPx
      : 0;

  return useMemo(() => {
    let closedLeftPx: number;
    let openCenterShiftPx: number;

    if (mode === 'button') {
      closedLeftPx = cfg.buttonModeLeftInsetPx + cfg.buttonModeWidthPx + cfg.gapPx;
      openCenterShiftPx = 0;
    } else if (mode === 'floating') {
      closedLeftPx = cfg.floatingModeLeftInsetPx + cfg.floatingModeWidthPx + cfg.gapPx;
      openCenterShiftPx = cfg.openCenterShiftWhenStudyAiFloatingPx;
    } else {
      closedLeftPx = cfg.closedLeftFallbackPx;
      openCenterShiftPx = 0;
    }

    openCenterShiftPx += quickLogShift;

    return {
      studyAiMode: mode,
      closedLeftPx,
      openCenterShiftPx,
    };
  }, [cfg, mode, quickLogShift]);
}
