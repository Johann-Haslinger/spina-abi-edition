import type { ReactNode } from 'react';

export function ViewerIconButton(props: {
  ariaLabel: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={props.ariaLabel}
      onClick={props.onClick}
      className="inline-flex size-10 text-2xl items-center justify-center rounded-full border border-black/10 bg-black/5 text-black dark:text-white dark:bg-white/5 backdrop-blur transition hover:bg-black/45 active:bg-black/55"
    >
      {props.children}
    </button>
  );
}
