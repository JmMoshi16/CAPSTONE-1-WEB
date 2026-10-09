'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

// Catches render errors in one dashboard page so the sidebar and other pages keep working (audit M-06).
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div role="alert" className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <AlertTriangle className="w-14 h-14 text-red-400" aria-hidden />
        <p className="text-white font-bold text-lg">This page hit an error</p>
        <p className="text-white/40 text-sm">Some data could not be displayed. Try again, or open another page from the menu.</p>
        <div className="flex gap-3">
          <button onClick={reset} className="px-6 py-2 bg-green/10 border border-green/30 rounded-xl text-green font-bold hover:bg-green/20 transition">Try again</button>
          <Link href="/dashboard" className="px-6 py-2 bg-white/5 border border-white/10 rounded-xl text-white/70 font-bold hover:bg-white/10 transition">Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
