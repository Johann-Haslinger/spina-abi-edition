import { useMemo, type ReactNode } from 'react';
import { hexToRgba } from '../features/session/viewer/viewerUtils';

export type FullscreenViewerFrameProps = {
  accentColor?: string;
  children: ReactNode;
  overlayLeft?: ReactNode;
  overlayRight?: ReactNode;
  overlayInfo?: ReactNode;
};

export function FullscreenViewerFrame(props: FullscreenViewerFrameProps) {
  const tint = useMemo(() => hexToRgba(props.accentColor, 0.3), [props.accentColor]);

  return (
    <div className="fixed inset-0 bg-white dark:bg-black z-40">
      <div className="absolute inset-0" style={{ backgroundColor: tint }} />
      {props.children}

      {props.overlayLeft ? (
        <div className="absolute left-3 z-10" style={{ top: 72 }}>
          {props.overlayLeft}
        </div>
      ) : null}

      {props.overlayRight ? (
        <div className="absolute right-3 z-10 flex items-center gap-2" style={{ top: 72 }}>
          {props.overlayRight}
        </div>
      ) : null}

      {props.overlayInfo ? (
        <div className="absolute inset-0 z-20 pointer-events-none">
          <div className="absolute right-3 pointer-events-auto" style={{ top: 128 }}>
            {props.overlayInfo}
          </div>
        </div>
      ) : null}
    </div>
  );
}
