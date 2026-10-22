'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Leaf, Loader2 } from 'lucide-react';
import BrandSplash from '@/components/BrandSplash';

// The three compartments, in the colours staff see everywhere else (kiosk, app, charts).
const BINS = [
  { label: 'Biodegradable', color: '#8BC34A', fill: 0.62 },
  { label: 'Recyclable', color: '#00B0FF', fill: 0.84 },
  { label: 'Residual', color: '#EF5350', fill: 0.38 },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user && isAdmin) {
      router.replace('/dashboard');
    }
  }, [authLoading, user, isAdmin, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { auth, db } = await import('@/lib/firebase');
      if (!auth || !db) { toast.error('Firebase not initialized'); setLoading(false); return; }

      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const { doc, getDoc } = await import('firebase/firestore');

      const credential = await signInWithEmailAndPassword(auth, email, password);
      const claimAdmin = (await credential.user.getIdTokenResult()).claims.admin === true;
      const isAdmin = claimAdmin || await getDoc(doc(db, 'users', credential.user.uid))
        .then(snap => snap.exists() && snap.data().role === 'admin');

      if (isAdmin) {
        // AuthContext finishes its own check and the effect above opens the dashboard;
        // navigating here as well raced with AuthGuard (see AuthContext).
        toast.success('Welcome back');
      } else {
        await auth.signOut();
        toast.error('Access denied. Admin accounts only.');
      }
    } catch (err: unknown) {
      // Never show raw Firebase error text (audit M-17), and do not reveal which part was wrong.
      const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : '';
      toast.error(
        code.includes('network') ? 'No internet connection. Please try again.'
        : code.includes('too-many-requests') ? 'Too many attempts. Please wait a moment and try again.'
        : code.startsWith('auth/') ? 'Email or password is incorrect.'
        : 'Could not sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error('Enter your email above first, then choose "Forgot password?"');
      return;
    }
    try {
      const { auth } = await import('@/lib/firebase');
      const { sendPasswordResetEmail } = await import('firebase/auth');
      if (auth) await sendPasswordResetEmail(auth, email.trim());
    } catch {
      // Same answer either way: never reveal whether an account exists.
    }
    toast.success('If that email has an account, a reset link is on its way.');
  };

  if (authLoading) return <BrandSplash label="Checking your session…" />;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] animate-fadeIn">
        <div className="bg-card/90 backdrop-blur border border-border rounded-[28px] p-8 sm:p-10 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.8)]">
          <div className="flex items-start justify-between mb-10">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-forest ring-1 ring-green/30 flex items-center justify-center">
                <Leaf className="w-5 h-5 text-green" aria-hidden />
              </div>
              <div className="font-display text-2xl font-semibold tracking-tight">
                <span className="text-green">ECO</span><span className="text-white">Reward</span>
              </div>
            </div>
            {/* Signature: the three bins fill once as the page opens. Decorative. */}
            <div className="flex items-end gap-1.5 h-10" aria-hidden>
              {BINS.map((b, i) => (
                <div key={b.label} className="w-2.5 h-full rounded-full bg-white/[0.06] overflow-hidden flex items-end">
                  <div
                    className="w-full rounded-full origin-bottom animate-[binFill_1.1s_cubic-bezier(0.22,1,0.36,1)_both]"
                    style={{ height: `${b.fill * 100}%`, backgroundColor: b.color, animationDelay: `${300 + i * 120}ms` }}
                  />
                </div>
              ))}
            </div>
          </div>

          <h1 className="text-3xl text-white">Staff sign-in</h1>
          <p className="text-white/50 text-sm mt-2 mb-8">Bins, scans, customers and rewards, all in one place.</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-white/70 text-sm font-medium mb-2">Email</label>
              <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full bg-raised border border-border rounded-btn px-4 py-3 text-white placeholder:text-white/25 focus:outline-none focus:border-green/60 focus:ring-4 focus:ring-green/10 transition"
                placeholder="you@yourcafe.com" required autoComplete="email" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-white/70 text-sm font-medium">Password</label>
                <button type="button" onClick={handleReset} className="text-xs text-green/80 hover:text-green transition">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full bg-raised border border-border rounded-btn pl-4 pr-12 py-3 text-white placeholder:text-white/25 focus:outline-none focus:border-green/60 focus:ring-4 focus:ring-green/10 transition"
                  placeholder="••••••••" required autoComplete="current-password" />
                <button type="button" onClick={() => setShowPassword(s => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-white/40 hover:text-white transition">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 bg-green hover:bg-dark-green text-bg font-semibold py-3.5 rounded-btn transition active:scale-[0.99] disabled:opacity-60">
              {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
        <p className="text-center text-white/30 text-xs mt-6">
          ECOReward Bin © {new Date().getFullYear()} · Staff only
        </p>
      </div>
    </div>
  );
}
