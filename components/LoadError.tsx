'use client';

import { AlertTriangle } from 'lucide-react';

/** Shown when a page's data has not arrived within the load timeout (audit C-05). */
export default function LoadError({ what }: { what: string }) {
  return (
    <div role="alert" className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center">
        <AlertTriangle className="w-14 h-14 text-red-400" aria-hidden />
        <p className="text-white font-bold text-lg">Failed to load {what}</p>
        <p className="text-white/40 text-sm max-w-sm">Check the internet connection and that you are signed in as an admin, then try again.</p>
        <button onClick={() => window.location.reload()}
          className="px-6 py-2 bg-green/10 border border-green/30 rounded-xl text-green font-bold hover:bg-green/20 transition">
          Retry
        </button>
      </div>
    </div>
  );
}
