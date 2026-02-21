import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { Minimize2, Redo2, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';
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
  src: string;
  tintColor: string | null;
  tintOpacity?: number;
  sizeClassName?: string;
}) {
  const { src, tintColor, tintOpacity = 1, sizeClassName = 'h-7 w-7' } = props;

  if (!tintColor) {
    return (
      <img
        src={src}
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
            WebkitMaskImage: `url(${src})`,
            maskImage: `url(${src})`,
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
        src={src}
        alt=""
        className="absolute inset-0 h-full w-full object-contain object-bottom"
        style={{ filter: 'url(#ink-toolbar-white-to-transparent)' }}
        aria-hidden
      />
    </div>
  );
}

export function InkToolbar(props: { activeAttemptId: string | null }) {
  const [open, setOpen] = useState(false);
  const brush = useInkStore((s) => s.brush);
  const setBrush = useInkStore((s) => s.setBrush);
  const pencilColor = useInkStore((s) => s.pencilColor);
  const markerColor = useInkStore((s) => s.markerColor);
  const setColorForBrush = useInkStore((s) => s.setColorForBrush);
  const undoStackLen = useInkStore((s) => s.undoStack.length);
  const redoStackLen = useInkStore((s) => s.redoStack.length);

  const { undoWithPersist, redoWithPersist } = useInkActions();

  const toolButtons = useMemo(
    () =>
      [
        { id: 'pencil' as const, label: 'Pencil', src: '/ink/pencil.png' },
        { id: 'marker' as const, label: 'Marker', src: '/ink/marker.png' },
        { id: 'eraser' as const, label: 'Eraser', src: '/ink/eraser.png' },
        { id: 'select' as const, label: 'Auswahl', src: '/ink/select.png' },
      ] as const,
    [],
  );

  if (!isProbablyIpad()) return null;
  if (!props.activeAttemptId) return null;

  const activeTool = toolButtons.find((t) => t.id === brush) ?? toolButtons[0]!;
  const activeTintColor =
    brush === 'pencil' ? pencilColor : brush === 'marker' ? markerColor : null;
  const activeTintOpacity = brush === 'marker' ? 0.6 : 1;

  return (
    <LayoutGroup id="ink-toolbar">
      <svg width={0} height={0} className="absolute pointer-events-none">
        <defs>
          <filter
            id="ink-toolbar-white-to-transparent"
            colorInterpolationFilters="sRGB"
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
            filterUnits="objectBoundingBox"
          >
            <feColorMatrix in="SourceGraphic" type="luminanceToAlpha" result="luma" />
            <feComponentTransfer in="luma" result="alphaMask">
              <feFuncA type="discrete" tableValues="1 1 1 1 1 1 1 1 1 1 1 1 0 0 0 0 0 0 0 0 0" />
            </feComponentTransfer>
            <feComposite in="SourceGraphic" in2="alphaMask" operator="in" result="masked" />
            <feComposite in="masked" in2="SourceAlpha" operator="in" />
          </filter>
        </defs>
      </svg>
      <AnimatePresence initial={false} mode="popLayout">
        {open ? (
          <div
            key="open"
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto"
          >
            <motion.div
              layoutId="ink-toolbar-surface"
              transition={MORPH_TRANSITION}
              className="w-fit rounded-full border overflow-hidden px-6 border-[#3C4E68] bg-[#243957]/70 shadow-lg backdrop-blur dark:border-white/5"
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
                              className="absolute inset-0 h-full w-full"
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
                              src={t.src}
                              alt=""
                              className="absolute inset-0 h-full w-full object-contain object-bottom"
                              style={{ filter: 'url(#ink-toolbar-white-to-transparent)' }}
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
          <div key="closed" className="absolute bottom-6 left-6 z-50 pointer-events-auto">
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
              className="size-18 overflow-hidden rounded-full border border-white/5 bg-[#243957]/70 shadow-xl backdrop-blur active:scale-[0.98] flex items-center justify-center"
            >
              <ToolPreview
                src={activeTool.src}
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
