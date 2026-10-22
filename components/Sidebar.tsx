'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, BarChart3, Trash2, Users, Gift, History, Settings, LogOut, Leaf, Menu, X, ClipboardCheck, Trophy, Award,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/lib/AuthContext';
import toast from 'react-hot-toast';

// Grouped by the job staff are doing, not by how the app is built. Labels are unchanged (e2e tests use them).
const NAV_GROUPS = [
  { title: 'Overview', items: [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/analytics', icon: BarChart3, label: 'Analytics' },
    { href: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
  ] },
  { title: 'At the bin', items: [
    { href: '/bins', icon: Trash2, label: 'Bin Management' },
    { href: '/scan-history', icon: History, label: 'Scan History' },
    { href: '/manual-claim', icon: ClipboardCheck, label: 'Manual Claim' },
  ] },
  { title: 'Customers', items: [
    { href: '/users', icon: Users, label: 'Users' },
    { href: '/rewards', icon: Gift, label: 'Rewards & Redemptions' },
    { href: '/badges', icon: Award, label: 'Badges' },
  ] },
  { title: 'System', items: [
    { href: '/settings', icon: Settings, label: 'Settings' },
  ] },
];

function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`${small ? 'w-8 h-8' : 'w-10 h-10'} rounded-full bg-forest flex items-center justify-center shrink-0 ring-1 ring-green/30`}>
        <Leaf className={`${small ? 'w-4 h-4' : 'w-5 h-5'} text-green`} aria-hidden />
      </div>
      <div className="min-w-0 leading-tight">
        <div className={`font-display font-semibold tracking-tight ${small ? 'text-lg' : 'text-xl'}`}>
          <span className="text-green">ECO</span><span className="text-white">Reward</span>
        </div>
        {!small && <div className="eyebrow mt-0.5">Staff console</div>}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Sliding indicator: one pill that moves to the active link instead of each link lighting up on its own.
  const navRef = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ top: number; height: number } | null>(null);
  const measure = () => {
    const active = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    setPill(active ? { top: active.offsetTop, height: active.offsetHeight } : null);
  };
  useLayoutEffect(measure, [pathname]);
  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const handleLogout = async () => {
    try {
      const { auth } = await import('@/lib/firebase');
      if (auth) await signOut(auth);
      toast.success('Logged out');
      router.replace('/');
    } catch {
      toast.error('Could not log out. Try again.');
    }
  };

  const navContent = (withIndicator: boolean) => (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-7 pb-6">
        <Wordmark />
      </div>

      <nav ref={withIndicator ? navRef : undefined} aria-label="Main" className="relative flex-1 px-3 pb-4 overflow-y-auto">
        {withIndicator && pill && (
          <span
            aria-hidden
            className="absolute left-3 right-3 rounded-xl bg-green/10 ring-1 ring-green/20 transition-all duration-500 ease-out"
            style={{ top: pill.top, height: pill.height }}
          >
            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-green" />
          </span>
        )}
        {NAV_GROUPS.map(group => (
          <div key={group.title} className="mb-4">
            <div className="eyebrow px-4 pb-2 pt-1">{group.title}</div>
            {group.items.map(({ href, icon: Icon, label }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={`relative flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors duration-200 ${
                    isActive
                      ? `text-green font-semibold ${withIndicator ? '' : 'bg-green/10'}`
                      : 'text-white/55 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" aria-hidden />
                  <span className="text-sm">{label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-raised ring-1 ring-border flex items-center justify-center text-xs font-bold text-white/70 shrink-0">
            {(user?.email ?? 'A')[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-white/40">Signed in as</div>
            <div className="text-sm text-white/80 truncate">{user?.email ?? 'Staff'}</div>
          </div>
          <button
            onClick={handleLogout}
            aria-label="Logout"
            title="Logout"
            className="p-2 rounded-lg text-white/40 hover:text-res hover:bg-res/10 transition-colors"
          >
            <LogOut className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-64 bg-card/80 backdrop-blur-sm border-r border-border flex-col z-30">
        {navContent(true)}
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-card/90 backdrop-blur-sm border-b border-border flex items-center justify-between px-4 z-30">
        <Wordmark small />
        <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="p-2 -mr-2 text-white/60 hover:text-white transition">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/60 animate-[fadeOnly_200ms_ease-out]" onClick={() => setMobileOpen(false)} />
          <div className="relative w-72 bg-card border-r border-border h-full z-50 animate-[slideIn_300ms_cubic-bezier(0.22,1,0.36,1)]">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute top-6 right-4 p-1 text-white/40 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
            {navContent(false)}
          </div>
        </div>
      )}
    </>
  );
}
