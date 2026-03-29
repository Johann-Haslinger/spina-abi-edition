import { type ReactNode } from 'react';
import { useAppSurfaceTheme } from '../ui/hooks/useAppSurfaceTheme';
import type { AppSurfaceTheme } from '../ui/subjectThemeSurfaces';

export type FullscreenViewerFrameProps = {
  children: ReactNode;
  overlayLeft?: ReactNode;
  overlayRight?: ReactNode;
  surfaceTheme?: AppSurfaceTheme;
};

export function FullscreenViewerFrame(props: FullscreenViewerFrameProps) {
  useAppSurfaceTheme(props.surfaceTheme);

  return (
    <div
      className="fixed inset-0 z-40 h-screen select-none"
      style={{
        backgroundColor: props.surfaceTheme?.pageBackground ?? 'var(--app-page-bg)',
      }}
    >
      <div className="absolute inset-0" />
      {props.children}

      {props.overlayLeft ? (
        <div className="fixed left-6 top-6 z-10">{props.overlayLeft}</div>
      ) : null}

      {props.overlayRight ? (
        <div className="fixed bottom-6 right-6 z-10 flex items-center gap-2">
          {props.overlayRight}
        </div>
      ) : null}
    </div>
  );
}
