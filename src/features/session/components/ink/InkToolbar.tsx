import { Minimize2, Paintbrush, Redo2, Undo2 } from 'lucide-react';
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

  if (!open) {
    return (
      <div className="absolute bottom-4 left-4 z-50 pointer-events-auto">
        <button
          type="button"
          aria-label="Stift öffnen"
          onClick={() => setOpen(true)}
          className="h-12 w-12 rounded-2xl border border-white/10 bg-slate-950/70 text-slate-100 shadow-xl backdrop-blur hover:bg-slate-950/80 active:scale-[0.98]"
        >
          <Paintbrush className="mx-auto h-5 w-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
      <svg width={0} height={0} className="absolute">
        <defs>
          <filter
            id="white-to-transparent"
            colorInterpolationFilters="sRGB"
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
            filterUnits="objectBoundingBox"
          >
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      -0.3 -0.59 -0.11 0 1"
              result="whiteFaded"
            />
            <feComposite in="whiteFaded" in2="SourceAlpha" operator="in" />
          </filter>
        </defs>
      </svg>
      <div className="w-fit rounded-full border overflow-hidden px-6 border-[#3C4E68] bg-[#243957]/70 shadow-lg backdrop-blur dark:border-white/5">
        <div className="flex items-stretch gap-6">
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
                  className={`relative flex h-22 w-12 shrink-0 items-center justify-center overflow-hidden transition-all duration-200 `}
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
                        style={{ filter: 'url(#white-to-transparent)' }}
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
        </div>
      </div>
    </div>
  );
}
