import { useEffect, useState } from 'react';

/**
 * Returns true only while `loading` has stayed true for `ms` milliseconds.
 *
 * Why this exists (audit C-05): every dashboard page used to start
 *   setTimeout(() => { if (!ready.x) setError(true) }, 15000)
 * inside an effect with an empty dependency list. The callback closed over the
 * FIRST render's state, so 15 s after mount it always reported "failed to load",
 * even when the data had arrived long before.
 *
 * Here the timer belongs to the `loading` state itself: it starts when loading
 * starts, is cleared the moment loading ends (or the component unmounts), and the
 * returned value is derived (`loading && timedOut`), so the render in which loading
 * becomes false can never show the error. If the data arrives late, the page simply
 * recovers instead of staying stuck on the error screen.
 */
export function useLoadTimeout(loading: boolean, ms = 15000): boolean {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!loading) {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), ms);
    return () => clearTimeout(timer);
  }, [loading, ms]);

  return loading && timedOut;
}
