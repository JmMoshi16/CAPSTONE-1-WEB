'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A number that counts to its value: from 0 on first show, then from the old value when live data changes it.
 * Shows the final value straight away when the user asked for reduced motion.
 */
export default function CountUp({ value, duration = 900, format = (n: number) => Math.round(n).toLocaleString() }: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
}) {
  const [shown, setShown] = useState(0);   // not `value`: that would flash the total, then restart from 0
  const from = useRef(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(a + (value - a) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); from.current = value; };
  }, [value, duration]);

  return <>{format(shown)}</>;
}
