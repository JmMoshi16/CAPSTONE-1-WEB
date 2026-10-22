'use client';

import { CloudOff, RotateCw } from 'lucide-react';

/** Shown when a page's data has not arrived within the load timeout (audit C-05). */
export default function LoadError({ what }: { what: string }) {
  return (
    <div role="alert" className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-res/10 ring-1 ring-res/25 flex items-center justify-center mb-5">
          <CloudOff className="w-7 h-7 text-res" aria-hidden />
        </div>
        <h2 className="font-display text-2xl font-semibold text-white">Couldn&apos;t load {what}</h2>
        <p className="text-white/55 text-sm mt-2 leading-relaxed">
          Check the internet connection and that you&apos;re signed in as staff, then try again. If it keeps failing,
          the browser console (F12) names the cause, for example a missing index or a permission.
        </p>
        <button onClick={() => window.location.reload()}
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-green text-bg rounded-xl font-semibold hover:bg-dark-green active:scale-[0.98] transition">
          <RotateCw className="w-4 h-4" aria-hidden />
          Try again
        </button>
      </div>
    </div>
  );
}
