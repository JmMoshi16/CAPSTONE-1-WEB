'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface AuthUser {
  uid: string;
  email: string | null;
}

interface AuthState {
  user: AuthUser | null;
  isAdmin: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, isAdmin: false, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, isAdmin: false, loading: true });

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    async function init() {
      try {
        const { auth, db } = await import('@/lib/firebase');
        if (!auth || !db) {
          setState({ user: null, isAdmin: false, loading: false });
          return;
        }
        const { onAuthStateChanged } = await import('firebase/auth');
        const { doc, getDoc } = await import('firebase/firestore');

        unsubscribe = onAuthStateChanged(auth, async firebaseUser => {
          if (!firebaseUser) {
            setState({ user: null, isAdmin: false, loading: false });
            return;
          }
          try {
            const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
            const isAdmin = snap.exists() && snap.data().role === 'admin';
            setState({ user: { uid: firebaseUser.uid, email: firebaseUser.email }, isAdmin, loading: false });
          } catch {
            setState({ user: { uid: firebaseUser.uid, email: firebaseUser.email }, isAdmin: false, loading: false });
          }
        });
      } catch {
        setState({ user: null, isAdmin: false, loading: false });
      }
    }

    init();
    return () => unsubscribe?.();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
