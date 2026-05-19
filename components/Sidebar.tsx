'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, BarChart3, Trash2, Users, Gift, QrCode, Settings, LogOut, Recycle, Menu, X,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/lib/AuthContext';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/analytics', icon: BarChart3, label: 'Analytics' },
  { href: '/bins', icon: Trash2, label: 'Bin Management' },
  { href: '/users', icon: Users, label: 'Users' },
  { href: '/rewards', icon: Gift, label: 'Rewards & Redemptions' },
  { href: '/qr', icon: QrCode, label: 'QR Generator' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    try {
      const { auth } = await import('@/lib/firebase');
      if (auth) await signOut(auth);
      toast.success('Logged out successfully');
      router.replace('/');
    } catch {
      toast.error('Logout failed');
    }
  };

  const navContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green to-dark-green flex items-center justify-center shrink-0">
            <Recycle className="w-5 h-5 text-black" />
          </div>
          <div className="min-w-0">
            <h1 className="text-white font-bold text-sm">Admin Dashboard</h1>
            <p className="text-white/40 text-xs truncate">{user?.email ?? 'ECOReward BI'}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                isActive ? 'bg-green/10 text-green font-bold' : 'text-white/40 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-sm">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-border">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/40 hover:text-red-500 hover:bg-red-500/10 transition w-full"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex fixed left-0 top-0 h-screen w-64 bg-card border-r border-border flex-col z-30">
        {navContent}
      </div>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-card border-b border-border flex items-center justify-between px-4 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green to-dark-green flex items-center justify-center">
            <Recycle className="w-4 h-4 text-black" />
          </div>
          <span className="text-white font-bold text-sm">ECOReward Admin</span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="text-white/60 hover:text-white transition">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 bg-card border-r border-border h-full z-50">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
            {navContent}
          </div>
        </div>
      )}

      {/* Mobile top bar spacer */}
      <div className="lg:hidden h-14" />
    </>
  );
}
