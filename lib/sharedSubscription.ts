// One Firestore listener per query for the whole dashboard (audit M-03).
// Every page used to open its own onSnapshot on whole collections, so each navigation re-read
// everything. A shared subscription keeps a single listener, hands the latest snapshot to new
// subscribers immediately, and stays open for `idleMs` after the last page leaves so moving
// between pages costs no reads. A listener error resets it, so the next subscriber retries.

type Unsubscribe = () => void;
type Start<T> = (onData: (value: T) => void, onError: (error: unknown) => void) => Unsubscribe;

export function shareSubscription<T>(start: Start<T>, idleMs = 5 * 60_000) {
  const subscribers = new Set<(value: T) => void>();
  let stopListener: Unsubscribe | null = null;
  let latest: { value: T } | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  const stop = () => {
    stopListener?.();
    stopListener = null;
    latest = null;
  };

  return (callback: (value: T) => void): Unsubscribe => {
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
    subscribers.add(callback);

    if (!stopListener) {
      stopListener = start(
        value => { latest = { value }; subscribers.forEach(s => s(value)); },
        error => { console.error('[firestore listener]', error); stop(); },
      );
    } else if (latest) {
      callback(latest.value);
    }

    let active = true;
    return () => {
      if (!active) return;
      active = false;
      subscribers.delete(callback);
      if (subscribers.size === 0 && !idleTimer) {
        idleTimer = setTimeout(() => { idleTimer = null; if (subscribers.size === 0) stop(); }, idleMs);
      }
    };
  };
}
