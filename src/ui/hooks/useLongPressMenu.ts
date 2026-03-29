import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

type UseLongPressMenuOptions = {
  disabled?: boolean;
  menuEnabled?: boolean;
  isCompactDevice: boolean;
  onPrimaryAction: () => void;
  onOpenChange?: (open: boolean) => void;
  longPressMs?: number;
  movementThresholdPx?: number;
};

type PointerState = {
  id: number;
  x: number;
  y: number;
};

type RootHandlers = {
  onClick: (event: ReactMouseEvent<HTMLElement>) => void;
  onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerLeave: () => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
};

export function useLongPressMenu(options: UseLongPressMenuOptions) {
  const {
    disabled = false,
    menuEnabled = true,
    isCompactDevice,
    onPrimaryAction,
    onOpenChange,
    longPressMs = 360,
    movementThresholdPx = 12,
  } = options;

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const pointerRef = useRef<PointerState | null>(null);
  const suppressNextClickRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current == null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const closeMenu = useCallback(() => {
    clearTimer();
    pointerRef.current = null;
    setOpen((prev) => {
      if (!prev) return prev;
      onOpenChange?.(false);
      return false;
    });
  }, [clearTimer, onOpenChange]);

  const openMenu = useCallback(() => {
    clearTimer();
    pointerRef.current = null;
    setOpen((prev) => {
      if (prev) return prev;
      onOpenChange?.(true);
      return true;
    });
  }, [clearTimer, onOpenChange]);

  useEffect(() => closeMenu, [closeMenu]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      const panel = panelRef.current;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (root?.contains(target) || panel?.contains(target)) return;
      closeMenu();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };

    const handleScroll = () => closeMenu();

    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [closeMenu, open]);

  const startLongPress = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (disabled || !menuEnabled || !isCompactDevice) return;
      if (event.button !== 0) return;
      if (isInteractiveTarget(event.target, event.currentTarget)) return;

      clearTimer();
      pointerRef.current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };

      timerRef.current = window.setTimeout(() => {
        suppressNextClickRef.current = true;
        openMenu();
      }, longPressMs);
    },
    [clearTimer, disabled, isCompactDevice, longPressMs, menuEnabled, openMenu],
  );

  const cancelLongPress = useCallback(() => {
    clearTimer();
    pointerRef.current = null;
  }, [clearTimer]);

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const pointer = pointerRef.current;
      if (!pointer || pointer.id !== event.pointerId) return;
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      if (Math.hypot(dx, dy) >= movementThresholdPx) {
        cancelLongPress();
      }
    },
    [cancelLongPress, movementThresholdPx],
  );

  const rootHandlers: RootHandlers = {
    onClick: (event) => {
      if (disabled) return;
      if (suppressNextClickRef.current) {
        suppressNextClickRef.current = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (isInteractiveTarget(event.target, event.currentTarget)) return;
      if (open) {
        event.preventDefault();
        closeMenu();
        return;
      }
      onPrimaryAction();
    },
    onContextMenu: (event) => {
      if (disabled || !menuEnabled || isCompactDevice) return;
      if (isInteractiveTarget(event.target, event.currentTarget)) return;
      event.preventDefault();
      openMenu();
    },
    onKeyDown: (event) => {
      if (disabled) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (open) {
          closeMenu();
          return;
        }
        onPrimaryAction();
      }
      if (event.key === 'Escape') closeMenu();
    },
    onPointerDown: startLongPress,
    onPointerMove: handlePointerMove,
    onPointerLeave: cancelLongPress,
    onPointerUp: cancelLongPress,
    onPointerCancel: cancelLongPress,
  };

  return {
    open,
    openMenu,
    closeMenu,
    rootRef,
    panelRef,
    rootHandlers,
  };
}

function isInteractiveTarget(target: EventTarget | null, currentTarget?: EventTarget | null) {
  if (!(target instanceof Element)) return false;

  const interactive = target.closest(
    'button, a, input, textarea, select, summary, [role="button"], [data-collection-item-ignore]',
  );

  if (!interactive) return false;
  return interactive !== currentTarget;
}
