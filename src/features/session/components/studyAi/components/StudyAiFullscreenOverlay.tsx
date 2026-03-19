import { motion } from 'framer-motion';
import { Minimize2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { IoClose, IoTrash } from 'react-icons/io5';
import { GhostButton, SecondaryButton } from '../../../../../components/Button';
import type { StudyAiMessage } from '../../../stores/studyAiChatStore';
import { StudyAiGeneratingDots } from './StudyAiGeneratingDots';
import { StudyAiMessageList } from './StudyAiMessageList';

export function StudyAiFullscreenOverlay(props: {
  messages: StudyAiMessage[];
  sending: boolean;
  error: string | null;
  onMinimize: () => void;
  onClose: () => void;
  onClear: () => void;
  onRegenerate?: () => void;
}) {
  const scrollerRef = useAutoScrollToBottom(props.messages, props.sending);

  return (
    <motion.div
      className="pointer-events-auto absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
    >
      <div className="absolute inset-0 bg-[#26313F]/90 backdrop-blur" />

      <div className="absolute h-full inset-x-0 top-0 flex justify-center">
        <div ref={scrollerRef} className="h-full w-full py-40 overflow-y-scroll px-4">
          <div className="w-3/5 mx-auto">
            <StudyAiMessageList
              messages={props.messages}
              sending={props.sending}
              onRegenerate={props.onRegenerate}
            />
            {props.sending ? (
              <div className="mt-3">
                <StudyAiGeneratingDots />
              </div>
            ) : null}
            {props.error ? <div className="mt-3 text-xs text-rose-200">{props.error}</div> : null}
            <div className="h-60" />
          </div>
          <div className="absolute top-0 flex flex-col gap-2 pt-60 pl-4">
            <SecondaryButton onClick={props.onMinimize} icon={<Minimize2 className="size-4" />} />
            <GhostButton onClick={props.onClose} icon={<IoClose />} />
            <GhostButton onClick={props.onClear} icon={<IoTrash />} disabled={props.sending} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const useAutoScrollToBottom = (messages: StudyAiMessage[], sending: boolean) => {
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    const t = setTimeout(() => {
      requestAnimationFrame(() => {
        scrollToBottom();
        requestAnimationFrame(scrollToBottom);
      });
    }, 200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const raf1 = requestAnimationFrame(() => {
      scrollToBottom();
      requestAnimationFrame(scrollToBottom);
    });
    return () => cancelAnimationFrame(raf1);
  }, [messages.length, sending]);

  return scrollerRef;
};
