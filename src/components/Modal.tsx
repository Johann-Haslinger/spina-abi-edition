import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function Modal(props: {
  open: boolean;

  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { open, onClose, children, footer } = props;

  const node = (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-10000"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <motion.div
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          />
          <motion.div
            className="absolute flex flex-col left-1/2 max-h-[80vh] overflow-hidden -translate-x-1/2 mx-auto w-full max-w-lg rounded-4xl min-h-2/3 top-1/2 -translate-y-1/2 border border-white/15 bg-[#1E1E1E]/90 backdrop-blur shadow-xl"
            initial={{ opacity: 0, y: 14, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.985 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="min-h-0 flex-1 overflow-y-auto pb-28 p-6">{children}</div>
            {footer ? (
              <div className="pointer-events-auto absolute bottom-0 left-0 right-0 flex items-center justify-end gap-2 px-6 pt-4 pb-6 rounded-b-4xl">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return open ? node : null;
  return createPortal(node, document.body);
}
