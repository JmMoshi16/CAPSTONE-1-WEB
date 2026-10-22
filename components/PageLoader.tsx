/** Shown while a page's first data loads: the shape of the page instead of a spinner, so nothing jumps. */
export default function PageLoader({ what }: { what: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading {what}…</span>
      <div className="space-y-3" aria-hidden>
        <div className="skeleton h-3 w-28" />
        <div className="skeleton h-8 w-72" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-hidden>
        {[0, 1, 2, 3].map(i => <div key={i} className="skeleton h-28 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" aria-hidden>
        <div className="skeleton h-80 rounded-2xl lg:col-span-2" />
        <div className="skeleton h-80 rounded-2xl" />
      </div>
    </div>
  );
}
