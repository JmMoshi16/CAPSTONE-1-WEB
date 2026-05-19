'use client';

import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-bg">
        <Sidebar />
        <main className="flex-1 lg:ml-64 p-4 lg:p-6 overflow-y-auto min-h-screen">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
