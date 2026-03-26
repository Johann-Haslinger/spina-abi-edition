import { formatRailStateList } from '../learnPathUtils';
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
        <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div>
        {!isUser && message.currentState ? (
          <div className="mt-3 rounded-2xl border border-white/8 bg-black/20 px-3 py-2 text-xs text-white/65">
            <div>Current State: {message.currentState}</div>
            <div>Allowed Next States: {formatRailStateList(message.allowedNextStates ?? [])}</div>
            <div>Suggested Next State: {message.suggestedNextState ?? '–'}</div>
            <div>Applied Next State: {message.appliedNextState ?? '–'}</div>
            <div>State Changed: {message.stateChanged ? 'yes' : 'no'}</div>
            <div>Await User Reply: {message.awaitUserReply ? 'yes' : 'no'}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
