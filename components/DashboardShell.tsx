'use client';

import { usePathname } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 min-w-0 lg:ml-64 px-4 pb-8 pt-[72px] lg:p-8 overflow-y-auto min-h-screen">
          {/* Keyed by route: each page's blocks rise in once when it opens (globals.css .page-enter). */}
          <div key={pathname} className="page-enter mx-auto max-w-[1440px]">
            {children}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
