import { motion } from 'framer-motion';
import { Bot, Maximize2 } from 'lucide-react';
import { useMemo } from 'react';
import { IoClose } from 'react-icons/io5';
import { SecondaryButton } from '../../../../../components/Button';
import type { StudyAiMessage, StudyAiUiMode } from '../../../stores/studyAiChatStore';
import { StudyAiIconButton } from './StudyAiIconButton';
import { StudyAiInputRow } from './StudyAiInputRow';
import { StudyAiMessageList } from './StudyAiMessageList';

const SPRING = { type: 'spring', stiffness: 520, damping: 44 } as const;

export function StudyAiMorphShell(props: {
  mode: StudyAiUiMode;
  isCompactDevice: boolean;
  autoFocusCenter: boolean;
  messages: StudyAiMessage[];
  sending: boolean;
  error: string | null;
  draft: string;
  onDraftChange: (v: string) => void;
  onSubmit: () => void;
  onOpenCenter: () => void;
  onMaximize: () => void;
  onClose: () => void;
  onClear: () => void;
}) {
  const { stageClass, shellClass } = useStudyAiMorphLayout(props.mode);

  return (
    <div
      className={stageClass}
      onPointerDown={(e) => {
        if (props.mode !== 'center') return;
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <motion.div
        layout
        transition={SPRING}
        className={['pointer-events-auto touch-none', shellClass].join(' ')}
      >
        {props.mode === 'button' ? (
          <button
            type="button"
            className="grid size-full place-items-center rounded-full"
            onClick={props.onOpenCenter}
            aria-label="KI öffnen"
          >
            <Bot className="size-6" />
          </button>
        ) : null}

        {props.mode === 'center' ? (
          <div>
            <StudyAiInputRow
              value={props.draft}
              onChange={props.onDraftChange}
              onSubmit={props.onSubmit}
              sending={props.sending}
              placeholder="Frage zur Aufgabe…"
              autoFocus={props.isCompactDevice ? props.autoFocusCenter : true}
            />
          </div>
        ) : null}

        {props.mode === 'overlay' ? (
          <div>
            <StudyAiInputRow
              value={props.draft}
              onChange={props.onDraftChange}
              onSubmit={props.onSubmit}
              sending={props.sending}
              placeholder="Nachricht senden…"
              autoFocus={props.isCompactDevice ? false : true}
            />
          </div>
        ) : null}

        {props.mode === 'floating' ? (
          <>
            <div className="flex gap-2 absolute right-3 top-3">
              {/* <StudyAiIconButton
                ariaLabel="Leeren"
                onClick={props.onClear}
                disabled={props.sending}
              >
                <Trash2 className="size-4" />
              </StudyAiIconButton> */}
              <StudyAiIconButton ariaLabel="Maximieren" onClick={props.onMaximize}>
                <Maximize2 className="size-4" />
              </StudyAiIconButton>
              <SecondaryButton
                className="bg-white/10!"
                onClick={props.onClose}
                icon={<IoClose />}
              />
            </div>

            <div className="max-h-[440px] overflow-y-auto w-full pt-16 px-3 pb-28">
              <StudyAiMessageList messages={props.messages} compact />
              {props.sending ? (
                <div className="mt-2 text-xs text-slate-200/80">Antwort wird generiert…</div>
              ) : null}
              {props.error ? <div className="mt-2 text-xs text-rose-200">{props.error}</div> : null}
            </div>

            <div className="p-2 pt-4 bg-linear-to-b from-transparent to-[#243957] absolute bottom-0 left-0 right-0">
              <StudyAiInputRow
                value={props.draft}
                onChange={props.onDraftChange}
                onSubmit={props.onSubmit}
                sending={props.sending}
                placeholder="Nachricht…"
                dense
                autoFocus={props.isCompactDevice ? false : true}
              />
            </div>
          </>
        ) : null}
      </motion.div>
    </div>
  );
}

function useStudyAiMorphLayout(mode: StudyAiUiMode) {
  return useMemo(() => {
    const LAYOUT_BY_MODE: Record<
      StudyAiUiMode,
      {
        stageClass: string;
        shellClass: string;
      }
    > = {
      button: {
        stageClass: 'absolute inset-0 flex items-end justify-start p-6 pointer-events-none',
        shellClass:
          'grid size-18 place-items-center rounded-full border border-white/5 bg-[#243957]/80 text-white shadow-lg backdrop-blur',
      },
      center: {
        stageClass: 'absolute inset-0 grid place-items-center items-end p-6 pointer-events-auto',
        shellClass:
          'w-124 rounded-4xl border border-white/5 bg-[#243957]/80 px-3 py-2 text-white shadow-lg backdrop-blur',
      },
      overlay: {
        stageClass: 'absolute inset-0 flex items-end justify-center pb-6 pointer-events-none',
        shellClass:
          'w-124 rounded-4xl border border-white/5 bg-white/10 p-2 text-white shadow-lg backdrop-blur',
      },
      floating: {
        stageClass: 'absolute inset-0 flex items-end justify-start p-6 pointer-events-none',
        shellClass:
          'w-[360px] relative overflow-hidden rounded-3xl border border-white/10 bg-[#243957]/70 text-white shadow-2xl backdrop-blur',
      },
    };

    return LAYOUT_BY_MODE[mode];
  }, [mode]);
}
