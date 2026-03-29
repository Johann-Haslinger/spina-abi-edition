import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useThemeColorOverride } from '../ui/hooks/useAppSurfaceTheme';

export function Modal(props: {
  open: boolean;

  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { open, onClose, children, footer } = props;
  useThemeColorOverride('var(--app-modal-theme-color)', open);

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
            className="absolute inset-0"
            style={{ backgroundColor: 'var(--app-overlay-bg)' }}
            onClick={onClose}
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          />
          <motion.div
            className="absolute left-1/2 top-1/2 mx-auto flex min-h-2/3 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-4xl border border-white/15 shadow-xl backdrop-blur"
            style={{ backgroundColor: 'var(--app-modal-bg)' }}
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
