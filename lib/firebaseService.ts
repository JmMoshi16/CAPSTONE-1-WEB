import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  limit,
  runTransaction,
  serverTimestamp,
  startAfter,
  Timestamp,
  count,
  sum,
  getCountFromServer,
  getAggregateFromServer,
  type Query,
} from 'firebase/firestore';
import { db } from './firebase';
import { UserModel, WasteLog, Reward, Redemption, BinStatus, KioskStatus, QRScanRecord } from './types';
import { RULES } from './rules';
import { creditScan, pickClaimToken, type CreditRules } from './claim';
import { toDate, toIso } from './dates';
import { toCSV } from './csv';
import { shareSubscription } from './sharedSubscription';

// db is only null during SSR — these functions are only called from 'use client' components
// so we assert non-null here. If db is somehow null, Firestore will throw a clear error.
function getDb() {
  if (!db) throw new Error('Firestore not initialized — are you running in a browser?');
  return db;
}

// Browser-test builds count billed document reads (one per changed document) so the performance test can
// report reads per page (audit Phase 9). Never active in a real build.
const countReads = (n: number) => {
  if (process.env.NEXT_PUBLIC_USE_EMULATORS === '1' && typeof window !== 'undefined') {
    const w = window as unknown as { __ecoReads?: number };
    w.__ecoReads = (w.__ecoReads ?? 0) + n;
  }
};

// Every date field is normalised here, at the boundary, to an ISO string or '' (audit H-07/M-06):
// Firestore holds Timestamps and ISO strings, and `new Date(Timestamp)` is Invalid Date.
// The subscribe* functions are shared (lib/sharedSubscription.ts): one listener per query for the
// whole dashboard instead of one per page visit (audit M-03).

// ─── Users ────────────────────────────────────────────────────────────────────

export const subscribeToCustomers = shareSubscription<UserModel[]>((onData, onError) =>
  onSnapshot(query(collection(getDb(), 'users'), where('role', '==', 'customer')), snapshot => {
    countReads(snapshot.docChanges().length);
    onData(snapshot.docs.map(d => {
      const data = d.data();
      return { uid: d.id, ...data, createdAt: toIso(data.createdAt) } as UserModel;
    }));
  }, onError));

// ─── Leaderboard ─────────────────────────────────────────────────────────────

/** Top customers by lifetime points, matching the phone app (audit M-07 / M-11). Firestore applies
 *  the limit; customers without `lifetimePoints` appear once tools/backfill_profiles.py has run. */
export const LEADERBOARD_SIZE = 50;
export const subscribeToLeaderboard = shareSubscription<UserModel[]>((onData, onError) =>
  onSnapshot(query(
    collection(getDb(), 'users'),
    where('role', '==', 'customer'),
    orderBy('lifetimePoints', 'desc'),
    limit(LEADERBOARD_SIZE),
  ), snapshot => {
    countReads(snapshot.docChanges().length);
    onData(snapshot.docs.map(d => {
      const data = d.data();
      return { uid: d.id, ...data, createdAt: toIso(data.createdAt) } as UserModel;
    }));
  }, onError));

// ─── Waste Logs ───────────────────────────────────────────────────────────────

export const subscribeToWasteLogs = shareSubscription<WasteLog[]>((onData, onError) =>
  onSnapshot(query(collection(getDb(), 'waste_logs'), orderBy('timestamp', 'desc')), snapshot => {
    countReads(snapshot.docChanges().length);
    onData(snapshot.docs.map(d => {
      const data = d.data();
      return { id: d.id, ...data, timestamp: toIso(data.timestamp) } as WasteLog;
    }));
  }, onError));

// ─── Phase 9: bounded reads ───────────────────────────────────────────────────
// Dashboard, Analytics and Users only chart the last 30 days, so they share one listener on the last
// RECENT_DAYS of logs instead of every log ever written; "All time" loads subscribeToWasteLogs on demand.
// Needs Timestamp dates (run tools/migrate_timestamps.py --apply first): a date-range query does not
// match the old ISO-string timestamps.
export const RECENT_DAYS = 31;
const toLog = (id: string, data: Record<string, unknown>) => ({ id, ...data, timestamp: toIso(data.timestamp) } as WasteLog);

export const subscribeToRecentWasteLogs = shareSubscription<WasteLog[]>((onData, onError) => {
  const since = Timestamp.fromMillis(Date.now() - RECENT_DAYS * 86_400_000);
  return onSnapshot(query(collection(getDb(), 'waste_logs'), where('timestamp', '>=', since), orderBy('timestamp', 'desc')), snapshot => {
    countReads(snapshot.docChanges().length);
    onData(snapshot.docs.map(d => toLog(d.id, d.data())));
  }, onError);
});

/** One customer's logs, newest first - loaded only when their details panel opens. */
export const getUserWasteLogs = async (uid: string): Promise<WasteLog[]> => {
  const snap = await getDocs(query(collection(getDb(), 'waste_logs'), where('userId', '==', uid), orderBy('timestamp', 'desc')));
  countReads(snap.size);
  return snap.docs.map(d => toLog(d.id, d.data()));
};

// Server-side aggregations are billed about one read per 1,000 documents counted.
const aggReads = (counted: number) => countReads(Math.max(1, Math.ceil(counted / 1000)));
const countOf = async (q: Query) => {
  const n = (await getCountFromServer(q)).data().count;
  aggReads(n);
  return n;
};

/** Number of waste logs in [from, to) without downloading them (e.g. the previous period for growth). */
export const countLogsBetween = (from: Date, to: Date): Promise<number> =>
  countOf(query(collection(getDb(), 'waste_logs'),
    where('timestamp', '>=', Timestamp.fromDate(from)), where('timestamp', '<', Timestamp.fromDate(to))));

export interface AdminStats { customers: number; lifetimePoints: number; redemptions: number; pendingRedemptions: number }

/** Totals for the dashboard without downloading every customer and redemption (audit M-03). */
export const getAdminStats = async (): Promise<AdminStats> => {
  const db = getDb();
  const customers = await getAggregateFromServer(query(collection(db, 'users'), where('role', '==', 'customer')),
    { n: count(), lifetime: sum('lifetimePoints') });
  aggReads(customers.data().n);
  const [redemptions, pendingRedemptions] = await Promise.all([
    countOf(collection(db, 'redemptions')),
    countOf(query(collection(db, 'redemptions'), where('status', '==', 'pending'))),
  ]);
  return { customers: customers.data().n, lifetimePoints: customers.data().lifetime ?? 0, redemptions, pendingRedemptions };
};

// ─── Rewards ──────────────────────────────────────────────────────────────────

export const subscribeToRewards = shareSubscription<Reward[]>((onData, onError) =>
  onSnapshot(collection(getDb(), 'rewards'), snapshot => {
    countReads(snapshot.docChanges().length);
    onData(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Reward)));
  }, onError));

export const addReward = async (reward: Omit<Reward, 'id'>): Promise<void> => {
  await addDoc(collection(getDb(), 'rewards'), reward);
};

export const updateReward = async (id: string, reward: Partial<Reward>): Promise<void> => {
  await updateDoc(doc(getDb(), 'rewards', id), reward);
};

export const deleteReward = async (id: string): Promise<void> => {
  await deleteDoc(doc(getDb(), 'rewards', id));
};

// ─── Redemptions ──────────────────────────────────────────────────────────────

export const subscribeToRedemptions = shareSubscription<Redemption[]>((onData, onError) =>
  onSnapshot(query(collection(getDb(), 'redemptions'), orderBy('redeemedAt', 'desc')), snapshot => {
    countReads(snapshot.docChanges().length);
    onData(snapshot.docs.map(d => {
      const data = d.data();
      return { id: d.id, ...data, redeemedAt: toIso(data.redeemedAt) } as Redemption;
    }));
  }, onError));

export const markRedemptionClaimed = async (id: string): Promise<void> => {
  await updateDoc(doc(getDb(), 'redemptions', id), { status: 'claimed' });
};

// ─── QR Scan History ──────────────────────────────────────────────────────────

// The newest SCAN_PAGE scans live; older pages on request; totals by aggregation (audit Phase 9 -
// this used to download every scan ever made on each visit).
export const SCAN_PAGE = 200;
const toScan = (id: string, data: Record<string, unknown>) => ({
  id, ...data,
  scannedAt:      toIso(data.scannedAt),
  tokenCreatedAt: toIso(data.tokenCreatedAt),
  expiresAt:      toIso(data.expiresAt),
} as QRScanRecord);

export const subscribeToQRHistory = shareSubscription<QRScanRecord[]>((onData, onError) =>
  onSnapshot(query(collection(getDb(), 'qr_scan_history'), orderBy('scannedAt', 'desc'), limit(SCAN_PAGE)), snapshot => {
    countReads(snapshot.docChanges().length);
    onData(snapshot.docs.map(d => toScan(d.id, d.data())));
  }, onError));

/** The next SCAN_PAGE scans older than `beforeIso`. */
export const loadOlderScans = async (beforeIso: string): Promise<QRScanRecord[]> => {
  const before = toDate(beforeIso);
  if (!before) return [];
  const snap = await getDocs(query(collection(getDb(), 'qr_scan_history'), orderBy('scannedAt', 'desc'),
    startAfter(Timestamp.fromDate(before)), limit(SCAN_PAGE)));
  countReads(snap.size);
  return snap.docs.map(d => toScan(d.id, d.data()));
};

export interface ScanCounts { total: number; Biodegradable: number; Recyclable: number; Residual: number }
export const getScanCounts = async (): Promise<ScanCounts> => {
  const c = collection(getDb(), 'qr_scan_history');
  const [total, Biodegradable, Recyclable, Residual] = await Promise.all([
    countOf(c),
    countOf(query(c, where('wasteType', '==', 'Biodegradable'))),
    countOf(query(c, where('wasteType', '==', 'Recyclable'))),
    countOf(query(c, where('wasteType', '==', 'Residual'))),
  ]);
  return { total, Biodegradable, Recyclable, Residual };
};

// ─── Bins ─────────────────────────────────────────────────────────────────────

export const subscribeToBins = shareSubscription<BinStatus[]>((onData, onError) =>
  onSnapshot(collection(getDb(), 'bins'), snapshot => {
    countReads(snapshot.docChanges().length);
    onData(snapshot.docs.map(d => {
      const data = d.data();
      return { binId: d.id, ...data, lastUpdated: toIso(data.lastUpdated) } as BinStatus;
    }));
  }, onError));

// The kiosk's heartbeat (app.py writes kiosks/{id} every 30 s).
export const subscribeToKiosks = shareSubscription<KioskStatus[]>((onData, onError) =>
  onSnapshot(collection(getDb(), 'kiosks'), snapshot => {
    countReads(snapshot.docChanges().length);
    onData(snapshot.docs.map(d => {
      const data = d.data();
      return { kioskId: d.id, ...data, lastSeen: toIso(data.lastSeen) } as KioskStatus;
    }));
  }, onError));

// There is no settings write: the kiosk and the phone app take points and QR expiry from
// config/rules.json, never from a settings document, so a web form could not change them.

// ─── Manual Claim ────────────────────────────────────────────────────────────

/**
 * Staff enters the receipt's claim code (ECO-dddd) + the customer's username, confirms the account by its
 * email, then manualClaimPoints credits that exact account exactly like a phone scan (lib/claim.ts).
 */
export interface ClaimCandidate { uid: string; username: string; email: string; points: number }

/** Every customer with this username: usernames are not unique, so staff choose by email when there are several. */
export const lookupUsersByUsername = async (username: string): Promise<ClaimCandidate[]> => {
  const firestore = getDb();
  const snap = await getDocs(query(collection(firestore, 'users'), where('username', '==', username),
    where('role', '==', 'customer'), limit(10)));
  return snap.docs.map(d => ({ uid: d.id, username: d.data().username, email: d.data().email, points: d.data().points ?? 0 }));
};

export const manualClaimPoints = async (
  claimCode: string,
  uid: string,
): Promise<{ success: boolean; error?: string; result?: { username: string; email: string; wasteType: string; pointsAwarded: number; newBadges: string[] } }> => {
  const firestore = getDb();

  // claimCode is a 4-digit number stored on the token
  const code = claimCode.replace(/^ECO-/i, '').trim();
  if (!/^\d{4}$/.test(code)) return { success: false, error: 'Invalid claim code. Expected ECO-XXXX (4 digits).' };

  // 4 digits can repeat: look at EVERY unused token with this code, never just the first.
  const tokensSnap = await getDocs(
    query(collection(firestore, 'qr_tokens'), where('claimCode', '==', code), where('isUsed', '==', false))
  );
  const pick = pickClaimToken(tokensSnap.docs.map(d => ({ id: d.id, expiresAt: toDate(d.data().expiresAt) })), new Date());
  if (!pick.ok) {
    return { success: false, error: {
      'not-found': 'Claim code not found. It may have already been used or does not exist.',
      expired: 'This claim code has expired.',
      ambiguous: 'Two receipts share this code right now. Ask the customer to scan the QR code with the app instead.',
    }[pick.reason] };
  }
  const tokenId = pick.id;

  // Mark token used + credit + log waste in one transaction, with the same streak, multiplier, scan count and
  // badges as a phone scan. Keeps lifetimePoints and the public profiles/{uid} copy in step (audit M-11 / H-13).
  const ALREADY_USED = 'already-used', NO_USER = 'no-user';
  try {
    const out = await runTransaction(firestore, async tx => {
      const tokenRef = doc(firestore, 'qr_tokens', tokenId);
      const userRef = doc(firestore, 'users', uid);
      // Re-check inside the transaction: the phone or another staff member may have claimed the
      // token since the query above (audit H-06 race).
      const liveToken = (await tx.get(tokenRef)).data();
      if (!liveToken || liveToken.isUsed === true || (liveToken.usedBy ?? []).length > 0) throw new Error(ALREADY_USED);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists() || userSnap.data().role !== 'customer') throw new Error(NO_USER);
      const live = userSnap.data();
      const wasteType: string = liveToken.wasteType ?? 'Residual';
      const base = (RULES.points as Record<string, number>)[wasteType] ?? RULES.points.Residual;   // config/rules.json (audit M-24)
      const c = creditScan(live, base, new Date(), RULES as unknown as CreditRules);
      tx.update(tokenRef, { usedBy: [uid], isUsed: true });
      tx.update(userRef, { points: c.points, lifetimePoints: c.lifetimePoints, scanCount: c.scanCount,
        streak: c.streak, lastScanDate: c.lastScanDate, badges: c.badges });
      tx.set(doc(firestore, 'profiles', uid), {
        username: live.username ?? '', points: c.points, lifetimePoints: c.lifetimePoints, badges: c.badges,
      });
      tx.set(doc(collection(firestore, 'waste_logs')), {
        userId: uid, wasteType, pointsEarned: base, pointsAwarded: c.awarded,
        timestamp: serverTimestamp(), binId: tokenId.substring(0, 8),
      });
      return { username: live.username ?? '', email: live.email ?? '', wasteType, pointsAwarded: c.awarded, newBadges: c.newBadges };
    });
    return { success: true, result: out };
  } catch (e) {
    if (e instanceof Error && e.message === ALREADY_USED) {
      return { success: false, error: 'This claim code was just used by someone else.' };
    }
    if (e instanceof Error && e.message === NO_USER) {
      return { success: false, error: 'That customer account no longer exists.' };
    }
    throw e;
  }
};

// ─── CSV Export ───────────────────────────────────────────────────────────────

export const exportToCSV = (data: Record<string, unknown>[], filename: string): void => {
  if (data.length === 0) return;
  // RFC 4180 + formula neutralisation (audit M-04); BOM so Excel reads UTF-8 names correctly.
  const blob = new Blob(['﻿' + toCSV(data)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
