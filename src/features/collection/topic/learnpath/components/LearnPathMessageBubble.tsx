import type { LearnPathMessage } from '../types';

export function LearnPathMessageBubble(props: { message: LearnPathMessage }) {
  const { message } = props;
  if (message.role === 'system') {
    return (
      <div className="flex justify-center">
        <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/65">
          {message.content}
        </div>
      </div>
    );
  }

  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-3xl px-4 py-3 ${
          isUser ? 'bg-white/10 text-white' : 'border border-white/8 bg-[#243957]/50 text-white'
        }`}
      >
        <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
        {!isUser ? (
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/55">
            {message.messageKind ? (
              <span className="rounded-full border border-white/10 px-2 py-1">
                {message.messageKind}
              </span>
            ) : null}
            {message.stepType ? (
              <span className="rounded-full border border-white/10 px-2 py-1">
                {message.stepType}
              </span>
            ) : null}
            {message.exercise?.type ? (
              <span className="rounded-full border border-white/10 px-2 py-1">
                {message.exercise.type}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
