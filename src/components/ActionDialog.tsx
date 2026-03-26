import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';

type ActionDialogTone = 'primary' | 'danger' | 'neutral';

export type ActionDialogAction = {
  key: string;
  label: string;
  tone?: ActionDialogTone;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
};

export function ActionDialog(props: {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
  actions: ActionDialogAction[];
  busy?: boolean;
}) {
  const busy = Boolean(props.busy);
  const node = (
    <AnimatePresence>
      {props.open ? (
        <motion.div
          className="fixed inset-0 z-10000"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <motion.div
            className="absolute inset-0 bg-black/50"
            onClick={busy ? undefined : props.onClose}
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          />
          <motion.div
            className="absolute left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/15 bg-[#1E1E1E]/95 p-5 shadow-xl backdrop-blur"
            initial={{ opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.985 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="text-center">
              <div className="text-base font-semibold text-white">{props.title}</div>
              <div className="mt-2 text-sm text-white/60">{props.message}</div>
            </div>
            <div className="mt-5 flex flex-col gap-3">
              {props.actions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  onClick={action.onClick}
                  disabled={busy || action.disabled}
                  className={`w-full cursor-pointer rounded-full px-3 py-2 text-sm font-medium disabled:opacity-50 ${toneClass(
                    action.tone ?? 'neutral',
                  )}`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return props.open ? node : null;
  return createPortal(node, document.body);
}

function toneClass(tone: ActionDialogTone): string {
  if (tone === 'primary') {
    return 'bg-white/90 hover:bg-white text-black';
  }
  if (tone === 'danger') {
    return 'bg-rose-600 hover:bg-rose-700 text-white';
  }
  return 'bg-white/3 text-white';
}
