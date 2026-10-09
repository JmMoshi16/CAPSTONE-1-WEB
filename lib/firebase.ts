import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';

// Browser tests only (npm run e2e): talk to the local Firebase emulators, never the real project.
const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === '1';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

// Only initialize Firebase in the browser — never during SSR/prerender
if (typeof window !== 'undefined' && firebaseConfig.apiKey) {
  const first = getApps().length === 0;
  app = first ? initializeApp(firebaseConfig) : getApps()[0];
  _auth = getAuth(app);
  _db = getFirestore(app);
  if (useEmulators && first) {
    connectAuthEmulator(_auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(_db, '127.0.0.1', 8085);
  }
}

export { _auth as auth, _db as db };
export default app;
