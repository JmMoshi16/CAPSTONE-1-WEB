'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import toast from 'react-hot-toast';
import { Recycle } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      if (!auth || !db) { toast.error('Firebase not initialized'); return; }

      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const { doc, getDoc } = await import('firebase/firestore');

      const credential = await signInWithEmailAndPassword(auth, email, password);
      const snap = await getDoc(doc(db, 'users', credential.user.uid));

      if (snap.exists() && snap.data().role === 'admin') {
        toast.success('Welcome back, Admin!');
        router.replace('/dashboard');
      } else {
        await auth.signOut();
        toast.error('Access denied. Admin accounts only.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-card p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green to-dark-green flex items-center justify-center mb-4">
              <Recycle className="w-8 h-8 text-black" />
            </div>
            <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-white/40 text-sm mt-1">ECOReward Business Intelligence</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-white/60 text-sm mb-2">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full bg-bg border border-border rounded-btn px-4 py-3 text-white focus:outline-none focus:border-green transition"
                placeholder="admin@ecoreward.com" required autoComplete="email" />
            </div>
            <div>
              <label className="block text-white/60 text-sm mb-2">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full bg-bg border border-border rounded-btn px-4 py-3 text-white focus:outline-none focus:border-green transition"
                placeholder="••••••••" required autoComplete="current-password" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-green hover:bg-dark-green text-black font-bold py-3 rounded-btn transition disabled:opacity-50">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
        <p className="text-center text-white/30 text-xs mt-6">
          ECOReward Bin © 2024 • IoT Waste Management System
        </p>
      </div>
    </div>
  );
}
