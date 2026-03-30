import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';
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

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;

    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverflow = documentElement.style.overflow;

    body.style.overflow = 'hidden';
    documentElement.style.overflow = 'hidden';

    return () => {
      body.style.overflow = previousBodyOverflow;
      documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [open]);

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
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <motion.div
              className="relative mx-auto flex max-h-full min-h-0 w-full max-w-lg flex-col overflow-hidden rounded-4xl border border-white/15 shadow-xl backdrop-blur"
              style={{ backgroundColor: 'var(--app-modal-bg)' }}
              initial={{ opacity: 0, y: 14, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.985 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <div className="min-h-0 flex-1 overflow-y-auto pb-28 p-6">{children}</div>
              {footer ? (
                <div className="pointer-events-auto absolute bottom-0 left-0 right-0 flex items-center justify-end gap-2 rounded-b-4xl px-6 pb-6 pt-4">
                  {footer}
                </div>
              ) : null}
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return open ? node : null;
  return createPortal(node, document.body);
}
