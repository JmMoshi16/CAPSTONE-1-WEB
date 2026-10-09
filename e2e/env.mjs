// Settings for the browser-test build: point the site at the local emulators, build into .next-e2e.
export const emulatorEnv = {
  NEXT_PUBLIC_USE_EMULATORS: '1',
  NEXT_PUBLIC_FIREBASE_API_KEY: 'demo-key',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-ecoreward.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-ecoreward',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: '',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '',
  NEXT_PUBLIC_FIREBASE_APP_ID: 'demo-app',
  NEXT_DIST_DIR: '.next-e2e',
};
