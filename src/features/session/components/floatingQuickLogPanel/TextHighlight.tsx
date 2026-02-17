import clsx from 'clsx';
import type React from 'react';

export function PanelHeading(props: { children: React.ReactNode }) {
  return <div className="text-[22px] font-bold">{props.children}</div>;
}

export function HighlightText(props: { children: React.ReactNode; className?: string }) {
  return <span className={clsx('text-white', props.className)}>{props.children}</span>;
}

export function MutedText(props: { children: React.ReactNode; className?: string }) {
  return <span className={clsx('text-white/70', props.className)}>{props.children}</span>;
}
