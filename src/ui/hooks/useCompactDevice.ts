import { useEffect, useState } from 'react';

function getIsCompactDevice() {
  if (typeof window === 'undefined') return false;

  const mqSmall = window.matchMedia('(max-width: 1024px)');
  const mqCoarse = window.matchMedia('(pointer: coarse)');
  const mqHoverNone = window.matchMedia('(hover: none)');
  return mqSmall.matches || (mqCoarse.matches && mqHoverNone.matches);
}

export function useCompactDevice() {
  const [isCompactDevice, setIsCompactDevice] = useState(() => getIsCompactDevice());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQueries = [
      window.matchMedia('(max-width: 1024px)'),
      window.matchMedia('(pointer: coarse)'),
      window.matchMedia('(hover: none)'),
    ];

    const update = () => setIsCompactDevice(getIsCompactDevice());
    update();

    for (const mq of mediaQueries) mq.addEventListener('change', update);
    return () => {
      for (const mq of mediaQueries) mq.removeEventListener('change', update);
    };
  }, []);

  return isCompactDevice;
}
