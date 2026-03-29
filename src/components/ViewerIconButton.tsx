import type { ReactNode } from 'react';

export function ViewerIconButton(props: {
  ariaLabel: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={props.ariaLabel}
      onClick={props.onClick}
      className={`inline-flex size-12 cursor-pointer items-center justify-center rounded-full border-[0.5px] border-white/10 bg-(--app-floating-bg) text-2xl text-white backdrop-blur transition hover:scale-105 hover:bg-(--app-floating-solid-bg) active:scale-95 active:bg-(--app-floating-solid-bg) ${props.className ?? ''}`}
    >
      {props.children}
    </button>
  );
}
