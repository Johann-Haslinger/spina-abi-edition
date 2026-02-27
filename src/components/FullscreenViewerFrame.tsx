import { type ReactNode } from 'react';

export type FullscreenViewerFrameProps = {
  children: ReactNode;
  overlayLeft?: ReactNode;
  overlayRight?: ReactNode;
};

export function FullscreenViewerFrame(props: FullscreenViewerFrameProps) {
  return (
    <div className="fixed h-screen dark:bg-[#1D3352] select-none inset-0 z-40">
      <div className="absolute inset-0" />
      {props.children}

      {props.overlayLeft ? (
        <div className="absolute left-8 z-10" style={{ top: 72 }}>
          {props.overlayLeft}
        </div>
      ) : null}

      {props.overlayRight ? (
        <div className="absolute bottom-8 right-6 z-10 flex items-center gap-2">
          {props.overlayRight}
        </div>
      ) : null}
    </div>
  );
}
