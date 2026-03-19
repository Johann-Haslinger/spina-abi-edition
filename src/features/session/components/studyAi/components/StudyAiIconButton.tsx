import type { ReactNode } from 'react';

export function StudyAiIconButton(props: {
  ariaLabel: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={props.ariaLabel}
      onClick={props.onClick}
      disabled={props.disabled}
      className="grid size-9 place-items-center rounded-full text-white/80 hover:bg-white/5 disabled:opacity-50"
    >
      {props.children}
    </button>
  );
}
