'use client';

import { useEffect } from 'react';

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div role="alert" className="min-h-screen flex items-center justify-center bg-bg">
      <div className="flex flex-col items-center gap-4 text-center max-w-md px-4">
        <p className="text-white font-bold text-lg">Something went wrong</p>
        <p className="text-white/40 text-sm">Reload the page. If it keeps happening, check the internet connection.</p>
        <button onClick={reset} className="px-6 py-2 bg-green/10 border border-green/30 rounded-xl text-green font-bold hover:bg-green/20 transition">Try again</button>
      </div>
    </div>
  );
}
