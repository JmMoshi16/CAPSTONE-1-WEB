// Seeds the Auth and Firestore EMULATORS (never the real project) before the browser tests.
import { PROJECT, ADMIN, CUSTOMER, SCANS } from './fixtures';

const AUTH = 'http://127.0.0.1:9099';
const FS = `http://127.0.0.1:8085/v1/projects/${PROJECT}/databases/(default)/documents`;

type Value = Record<string, unknown>;
function enc(v: unknown): Value {
  if (v === null) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, enc(x)])) } };
}

async function ok(res: Response, what: string) {
  if (!res.ok) throw new Error(`${what}: ${res.status} ${await res.text()}`);
  return res;
}

async function signUp(email: string, password: string): Promise<string> {
  const r = await ok(await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  }), `sign up ${email}`);
  return (await r.json()).localId;
}

async function write(docs: Record<string, Record<string, unknown>>) {
  const writes = Object.entries(docs).map(([path, data]) => ({
    update: { name: `projects/${PROJECT}/databases/(default)/documents/${path}`, fields: (enc(data) as { mapValue: { fields: Value } }).mapValue.fields },
  }));
  // "Bearer owner" is the emulator's admin bypass; it does not exist in production.
  await ok(await fetch(`${FS}:commit`, { method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes }) }), 'seed firestore');
}

export default async function globalSetup() {
  await ok(await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' }), 'clear auth');
  await ok(await fetch(`http://127.0.0.1:8085/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' }), 'clear firestore');

  const adminUid = await signUp(ADMIN.email, ADMIN.password);
  const aliceUid = await signUp(CUSTOMER.email, CUSTOMER.password);
  const now = new Date();
  const docs: Record<string, Record<string, unknown>> = {
    [`users/${adminUid}`]: { username: 'admin', email: ADMIN.email, role: 'admin', points: 0, createdAt: now, badges: [] },
    [`users/${aliceUid}`]: { username: CUSTOMER.username, email: CUSTOMER.email, role: 'customer', points: 25, lifetimePoints: 25,
      createdAt: now, scanCount: SCANS, streak: 1, lastScanDate: now.toISOString().slice(0, 10), badges: ['first_scan'] },
    [`profiles/${aliceUid}`]: { username: CUSTOMER.username, points: 25, lifetimePoints: 25, badges: ['first_scan'] },
    'rewards/coffee': { title: 'Free Coffee', description: 'A cup of coffee', pointsCost: 50, category: 'Coffee', isActive: true, stock: 5 },
    'settings/app': { pointsBiodegradable: 15, pointsRecyclable: 10, pointsResidual: 5, qrExpiryMinutes: 20, maxBinFillAlert: 80 },
  };
  for (let i = 0; i < SCANS; i++) {
    const at = new Date(now.getTime() - (i + 1) * 60_000);
    docs[`waste_logs/log${i}`] = { userId: aliceUid, wasteType: 'Recyclable', pointsEarned: 10, pointsAwarded: 10 + i * 5, timestamp: at, binId: `tok${i}` };
    docs[`qr_scan_history/scan${i}`] = { token: `tok${i}`, wasteType: 'Recyclable', scannedAt: at, scannedByUid: aliceUid,
      scannedByName: CUSTOMER.username, scannedByEmail: CUSTOMER.email, pointsAwarded: 10 + i * 5,
      tokenCreatedAt: new Date(at.getTime() - 30_000), expiresAt: new Date(at.getTime() + 20 * 60_000), secondsAfterCreation: 30 };
  }
  await write(docs);
}
