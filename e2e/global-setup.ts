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
    // Manual Claim: two customers share the username "sam"; receipt code 4321 has an expired twin and one live token.
    'users/sam1': { username: 'sam', email: 'sam1@e2e.test', role: 'customer', points: 0, lifetimePoints: 0, createdAt: now,
      scanCount: 4, streak: 0, badges: ['first_scan'] },
    'users/sam2': { username: 'sam', email: 'sam2@e2e.test', role: 'customer', points: 0, lifetimePoints: 0, createdAt: now,
      scanCount: 4, streak: 0, badges: ['first_scan'] },
    'qr_tokens/claim-old':  { wasteType: 'Residual', expiresAt: new Date(now.getTime() - 3_600_000), usedBy: [], isUsed: false,
      createdAt: new Date(now.getTime() - 4_000_000), claimCode: '4321' },
    'qr_tokens/claim-live': { wasteType: 'Biodegradable', expiresAt: new Date(now.getTime() + 20 * 60_000), usedBy: [], isUsed: false,
      createdAt: now, claimCode: '4321' },
    'rewards/coffee': { title: 'Free Coffee', description: 'A cup of coffee', pointsCost: 50, category: 'Coffee', isActive: true, stock: 5 },
    // Kiosk heartbeat and bins exactly as app.py writes them; the second kiosk crashed 10 minutes ago.
    'kiosks/kiosk-cafe': { lastSeen: now, status: 'online', name: 'CAFE-PC' },
    'kiosks/kiosk-old':  { lastSeen: new Date(now.getTime() - 10 * 60_000), status: 'online', name: 'OLD-PC' },
    'bins/kiosk-cafe-bio': { location: 'CAFE-PC · Biodegradable', fillLevel: 40,  status: 'online', lastUpdated: now },
    'bins/kiosk-cafe-rec': { location: 'CAFE-PC · Recyclable',    fillLevel: 92,  status: 'online', lastUpdated: now },
    'bins/kiosk-cafe-res': { location: 'CAFE-PC · Residual',      fillLevel: 100, status: 'online', lastUpdated: now },
  };
  for (let i = 0; i < SCANS; i++) {
    const at = new Date(now.getTime() - (i + 1) * 60_000);
    docs[`waste_logs/log${i}`] = { userId: aliceUid, wasteType: 'Recyclable', pointsEarned: 10, pointsAwarded: 10 + i * 5, timestamp: at, binId: `tok${i}` };
    docs[`qr_scan_history/scan${i}`] = { token: `tok${i}`, wasteType: 'Recyclable', scannedAt: at, scannedByUid: aliceUid,
      scannedByName: CUSTOMER.username, scannedByEmail: CUSTOMER.email, pointsAwarded: 10 + i * 5,
      tokenCreatedAt: new Date(at.getTime() - 30_000), expiresAt: new Date(at.getTime() + 20 * 60_000), secondsAfterCreation: 30 };
  }
  await write(docs);
  if (process.env.E2E_SEED === 'load') await seedLoad(now);
}

// Phase 9 load set: 500 customers, 5,000 waste logs and scans over 90 days, 300 redemptions.
export const LOAD = { customers: 500, scans: 5000, redemptions: 300, days: 90 };
async function seedLoad(now: Date) {
  const types = ['Biodegradable', 'Recyclable', 'Residual'] as const;
  const docs: Record<string, Record<string, unknown>> = {};
  const flush = async () => {
    const entries = Object.entries(docs);
    for (let i = 0; i < entries.length; i += 400) await write(Object.fromEntries(entries.slice(i, i + 400)));
    for (const k of Object.keys(docs)) delete docs[k];
  };
  for (let c = 0; c < LOAD.customers; c++) {
    const pts = (c * 37) % 900;
    docs[`users/load${c}`] = { username: `user${c}`, email: `user${c}@load.test`, role: 'customer', points: pts,
      lifetimePoints: pts + (c % 7) * 10, createdAt: new Date(now.getTime() - (c % LOAD.days) * 86_400_000),
      scanCount: Math.floor(LOAD.scans / LOAD.customers), streak: c % 5, badges: c % 3 ? ['first_scan'] : [] };
    docs[`profiles/load${c}`] = { username: `user${c}`, points: pts, lifetimePoints: pts + (c % 7) * 10, badges: c % 3 ? ['first_scan'] : [] };
  }
  await flush();
  for (let s = 0; s < LOAD.scans; s++) {
    const at = new Date(now.getTime() - ((s * 7919) % (LOAD.days * 86_400)) * 1000);
    const uid = `load${s % LOAD.customers}`, type = types[s % 3], pts = [15, 10, 5][s % 3];
    docs[`waste_logs/l${s}`] = { userId: uid, wasteType: type, pointsEarned: pts, pointsAwarded: pts, timestamp: at, binId: `t${s}` };
    docs[`qr_scan_history/h${s}`] = { token: `t${s}`, wasteType: type, scannedAt: at, scannedByUid: uid, scannedByName: `user${s % LOAD.customers}`,
      scannedByEmail: `user${s % LOAD.customers}@load.test`, pointsAwarded: pts, tokenCreatedAt: at, expiresAt: at, secondsAfterCreation: 40 };
    if (Object.keys(docs).length >= 2000) await flush();
  }
  await flush();
  for (let r = 0; r < LOAD.redemptions; r++) {
    docs[`redemptions/r${r}`] = { userId: `load${r}`, userEmail: `user${r}@load.test`, rewardId: 'coffee', rewardTitle: 'Free Coffee',
      pointsUsed: 50, redeemedAt: new Date(now.getTime() - r * 3_600_000), status: r % 4 ? 'claimed' : 'pending', redemptionCode: `R${r}` };
  }
  await flush();
}
