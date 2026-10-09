import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="flex flex-col items-center gap-4 text-center px-4">
        <p className="text-white font-bold text-2xl">Page not found</p>
        <p className="text-white/40 text-sm">This page does not exist in the ECOReward admin console.</p>
        <Link href="/dashboard" className="px-6 py-2 bg-green/10 border border-green/30 rounded-xl text-green font-bold hover:bg-green/20 transition">Go to the dashboard</Link>
      </div>
    </div>
  );
}
