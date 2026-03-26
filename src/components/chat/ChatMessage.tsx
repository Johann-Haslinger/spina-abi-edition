import type { ReactNode } from 'react';

type ChatMessageAlignment = 'start' | 'end' | 'center';

export function ChatMessage(props: {
  align?: ChatMessageAlignment;
  bubbleClassName?: string;
  containerClassName?: string;
  action?: ReactNode;
  onBubbleClick?: () => void;
  children: ReactNode;
}) {
  const align = props.align ?? 'start';
  const alignmentClassName =
    align === 'end' ? 'items-end' : align === 'center' ? 'items-center' : 'items-start';

  return (
    <div className={['group flex flex-col', alignmentClassName, props.containerClassName ?? ''].join(' ')}>
      <div
        className={['max-w-full', props.bubbleClassName ?? ''].join(' ')}
        onClick={props.onBubbleClick}
      >
        {props.children}
      </div>
      {props.action ? props.action : null}
    </div>
  );
}
