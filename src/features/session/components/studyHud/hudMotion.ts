import type { Transition, Variants } from 'framer-motion';

export const HUD_SPRING: Transition = {
  type: 'spring',
  stiffness: 520,
  damping: 44,
  mass: 0.9,
};

function makeHudVariants(offset: { x: number; y: number }): Variants {
  return {
    shown: {
      x: 0,
      y: 0,
      opacity: 1,
      scale: 1,
      transition: HUD_SPRING,
    },
    hidden: {
      x: offset.x,
      y: offset.y,
      opacity: 0,
      scale: 0.98,
      transition: HUD_SPRING,
    },
  };
}

// Big enough offsets so fixed widgets fully leave the viewport.
export const HUD_VARIANTS_TOP_RIGHT = makeHudVariants({ x: 560, y: -420 });
export const HUD_VARIANTS_BOTTOM_RIGHT = makeHudVariants({ x: 560, y: 420 });
export const HUD_VARIANTS_BOTTOM_LEFT = makeHudVariants({ x: -560, y: 420 });

