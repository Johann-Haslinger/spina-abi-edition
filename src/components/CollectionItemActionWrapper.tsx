import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useCompactDevice } from '../ui/hooks/useCompactDevice';
import { useLongPressMenu } from '../ui/hooks/useLongPressMenu';

type CollectionItemActionTone = 'default' | 'danger';

export type CollectionItemAction = {
  key: string;
  label: string;
  icon?: ReactNode;
  tone?: CollectionItemActionTone;
  onSelect: () => void | Promise<void>;
};

export function CollectionItemActionWrapper(props: {
  children: ReactNode;
  primaryAction: () => void;
  actions: CollectionItemAction[];
  className?: string;
  contentClassName?: string;
  disabled?: boolean;
}) {
  const isCompactDevice = useCompactDevice();
  const menuEnabled = props.actions.length > 0;
  const { open, closeMenu, rootRef, panelRef, rootHandlers } = useLongPressMenu({
    disabled: props.disabled,
    menuEnabled,
    isCompactDevice,
    onPrimaryAction: props.primaryAction,
  });

  return (
    <div className={props.className}>
      <div className="relative">
        {open ? (
          <div
            className="pointer-events-none absolute inset-0 -m-3 rounded-4xl bg-black/8 dark:bg-black/20"
            aria-hidden
          />
        ) : null}

        <motion.div
          ref={rootRef}
          role="button"
          tabIndex={0}
          aria-haspopup={menuEnabled ? 'menu' : undefined}
          aria-expanded={menuEnabled ? open : undefined}
          className={`relative z-10 cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${props.contentClassName ?? ''}`}
          animate={
            open
              ? {
                  scale: 1.03,
                  y: -4,
                  boxShadow: '0 22px 48px rgba(15, 23, 42, 0.34)',
                }
              : {
                  scale: 1,
                  y: 0,
                  boxShadow: '0 0 0 rgba(15, 23, 42, 0)',
                }
          }
          transition={{ type: 'spring', stiffness: 320, damping: 26, mass: 0.8 }}
          {...rootHandlers}
        >
          {props.children}
        </motion.div>

        <AnimatePresence>
          {open ? (
            <motion.div
              ref={panelRef}
              role="menu"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="absolute left-1/2 top-[calc(100%+0.8rem)] z-20 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-1 rounded-[1.35rem] border border-white/20 bg-(--app-modal-bg) p-1.5 shadow-2xl backdrop-blur-xl"
            >
              {props.actions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    closeMenu();
                    void action.onSelect();
                  }}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    action.tone === 'danger'
                      ? 'text-rose-200 hover:bg-rose-500/15'
                      : 'text-white hover:bg-white/10'
                  }`}
                >
                  {action.icon ? <span className="text-base">{action.icon}</span> : null}
                  <span>{action.label}</span>
                </button>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
