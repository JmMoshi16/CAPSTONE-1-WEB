'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import BrandSplash from '@/components/BrandSplash';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace('/');
    }
  }, [loading, user, isAdmin, router]);

  if (loading) {
    return <BrandSplash label="Checking your access…" />;
  }

  if (!user || !isAdmin) return null;

  return <>{children}</>;
}
