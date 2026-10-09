import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  onSnapshot,
  orderBy,
  limit,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { UserModel, WasteLog, Reward, Redemption, BinStatus, AppSettings, DEFAULT_SETTINGS, QRScanRecord } from './types';
import { toDate, toIso } from './dates';
import { toCSV } from './csv';
import { shareSubscription } from './sharedSubscription';

// db is only null during SSR — these functions are only called from 'use client' components
// so we assert non-null here. If db is somehow null, Firestore will throw a clear error.
function getDb() {
  if (!db) throw new Error('Firestore not initialized — are you running in a browser?');
  return db;
}

// Every date field is normalised here, at the boundary, to an ISO string or '' (audit H-07/M-06):
// Firestore holds Timestamps and ISO strings, and `new Date(Timestamp)` is Invalid Date.
// The subscribe* functions are shared (lib/sharedSubscription.ts): one listener per query for the
// whole dashboard instead of one per page visit (audit M-03).

// ─── Users ────────────────────────────────────────────────────────────────────

export const subscribeToCustomers = shareSubscription<UserModel[]>((onData, onError) =>
  onSnapshot(query(collection(getDb(), 'users'), where('role', '==', 'customer')), snapshot => {
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
    onData(snapshot.docs.map(d => {
      const data = d.data();
      return { uid: d.id, ...data, createdAt: toIso(data.createdAt) } as UserModel;
    }));
  }, onError));

// ─── Waste Logs ───────────────────────────────────────────────────────────────

export const subscribeToWasteLogs = shareSubscription<WasteLog[]>((onData, onError) =>
  onSnapshot(query(collection(getDb(), 'waste_logs'), orderBy('timestamp', 'desc')), snapshot => {
    onData(snapshot.docs.map(d => {
      const data = d.data();
      return { id: d.id, ...data, timestamp: toIso(data.timestamp) } as WasteLog;
    }));
  }, onError));

// ─── Rewards ──────────────────────────────────────────────────────────────────

export const subscribeToRewards = shareSubscription<Reward[]>((onData, onError) =>
  onSnapshot(collection(getDb(), 'rewards'), snapshot => {
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
    onData(snapshot.docs.map(d => {
      const data = d.data();
      return { id: d.id, ...data, redeemedAt: toIso(data.redeemedAt) } as Redemption;
    }));
  }, onError));

export const markRedemptionClaimed = async (id: string): Promise<void> => {
  await updateDoc(doc(getDb(), 'redemptions', id), { status: 'claimed' });
};

// ─── QR Scan History ──────────────────────────────────────────────────────────

export const subscribeToQRHistory = shareSubscription<QRScanRecord[]>((onData, onError) =>
  onSnapshot(query(collection(getDb(), 'qr_scan_history'), orderBy('scannedAt', 'desc')), snapshot => {
    onData(snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id, ...data,
        scannedAt:      toIso(data.scannedAt),
        tokenCreatedAt: toIso(data.tokenCreatedAt),
        expiresAt:      toIso(data.expiresAt),
      } as QRScanRecord;
    }));
  }, onError));

// ─── Bins ─────────────────────────────────────────────────────────────────────

export const subscribeToBins = shareSubscription<BinStatus[]>((onData, onError) =>
  onSnapshot(collection(getDb(), 'bins'), snapshot => {
    onData(snapshot.docs.map(d => {
      const data = d.data();
      return { binId: d.id, ...data, lastUpdated: toIso(data.lastUpdated) } as BinStatus;
    }));
  }, onError));

// ─── Settings ─────────────────────────────────────────────────────────────────

export const subscribeToSettings = shareSubscription<AppSettings>((onData, onError) =>
  onSnapshot(doc(getDb(), 'settings', 'app'), snap => {
    onData(snap.exists() ? { ...DEFAULT_SETTINGS, ...(snap.data() as AppSettings) } : DEFAULT_SETTINGS);
  }, onError));

export const saveSettings = async (settings: AppSettings): Promise<void> => {
  await setDoc(doc(getDb(), 'settings', 'app'), {
    ...settings,
    updatedAt: new Date().toISOString(),
  });
};

// ─── Manual Claim ────────────────────────────────────────────────────────────

/**
 * Staff enters a claim code (token[:6]-token[6:10]) + user Gmail.
 * Looks up the qr_token by reconstructing the prefix, finds the user by email,
 * marks the token as used, logs the waste, and credits points.
 */
export const lookupUserByUsername = async (
  username: string
): Promise<{ uid: string; username: string; email: string; points: number } | null> => {
  const firestore = getDb();
  const snap = await getDocs(query(collection(firestore, 'users'), where('username', '==', username), where('role', '==', 'customer')));
  if (snap.empty) return null;
  const d = snap.docs[0].data();
  return { uid: snap.docs[0].id, username: d.username, email: d.email, points: d.points ?? 0 };
};

export const manualClaimPoints = async (
  claimCode: string,
  email: string
): Promise<{ success: boolean; error?: string; result?: { username: string; email: string; wasteType: string; pointsAwarded: number } }> => {
  const firestore = getDb();

  // Find user by email (called after staff confirms the account)
  const userSnap = await getDocs(query(collection(firestore, 'users'), where('email', '==', email), where('role', '==', 'customer')));
  if (userSnap.empty) return { success: false, error: 'No account found with that Gmail address.' };
  const userDoc = userSnap.docs[0];
  const userData = userDoc.data() as UserModel;

  // claimCode is a 4-digit number stored on the token
  const code = claimCode.replace(/^ECO-/i, '').trim();
  if (!/^\d{4}$/.test(code)) return { success: false, error: 'Invalid claim code. Expected ECO-XXXX (4 digits).' };

  const tokensSnap = await getDocs(
    query(collection(firestore, 'qr_tokens'), where('claimCode', '==', code), where('isUsed', '==', false))
  );

  if (tokensSnap.empty) return { success: false, error: 'Claim code not found. It may have already been used or does not exist.' };
  const matchingToken = tokensSnap.docs[0];

  const tokenData = matchingToken.data();
  // Timestamp (H-07) or legacy ISO string; new Date(Timestamp) would be Invalid Date = never expired.
  const expiresAt = toDate(tokenData.expiresAt);
  if (expiresAt && new Date() > expiresAt) return { success: false, error: 'This QR token has expired.' };

  const usedBy: string[] = tokenData.usedBy ?? [];
  if (usedBy.includes(userDoc.id)) return { success: false, error: 'This claim code has already been used by this account.' };
  if (usedBy.length > 0) return { success: false, error: 'This claim code has already been used.' };

  const wasteType: string = tokenData.wasteType ?? 'Residual';
  const pointsMap: Record<string, number> = {   // config/rules.json via DEFAULT_SETTINGS (audit M-24)
    Biodegradable: DEFAULT_SETTINGS.pointsBiodegradable,
    Recyclable: DEFAULT_SETTINGS.pointsRecyclable,
    Residual: DEFAULT_SETTINGS.pointsResidual,
  };
  const pointsAwarded = pointsMap[wasteType] ?? DEFAULT_SETTINGS.pointsResidual;

  // Mark token used + credit points + log waste — all in one transaction.
  // Keeps lifetimePoints and the public profiles/{uid} copy in step with the app (audit M-11 / H-13).
  const ALREADY_USED = 'already-used';
  try {
    await runTransaction(firestore, async tx => {
      const tokenRef = doc(firestore, 'qr_tokens', matchingToken.id);
      const userRef = doc(firestore, 'users', userDoc.id);
      const logRef = doc(collection(firestore, 'waste_logs'));
      // Re-check inside the transaction: the phone or another staff member may have claimed the
      // token since the query above (audit H-06 race).
      const liveToken = (await tx.get(tokenRef)).data();
      if (!liveToken || liveToken.isUsed === true || (liveToken.usedBy ?? []).length > 0) throw new Error(ALREADY_USED);
      const live = (await tx.get(userRef)).data() ?? {};
      const points = (live.points ?? 0) + pointsAwarded;
      const lifetimePoints = (typeof live.lifetimePoints === 'number' ? live.lifetimePoints : live.points ?? 0) + pointsAwarded;
      tx.update(tokenRef, { usedBy: [...usedBy, userDoc.id], isUsed: true });
      tx.update(userRef, { points, lifetimePoints });
      tx.set(doc(firestore, 'profiles', userDoc.id), {
        username: live.username ?? '', points, lifetimePoints, badges: live.badges ?? [],
      });
      tx.set(logRef, {
        userId: userDoc.id,
        wasteType,
        pointsEarned: pointsAwarded,
        pointsAwarded,
        timestamp: serverTimestamp(),
        binId: matchingToken.id.substring(0, 8),
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === ALREADY_USED) {
      return { success: false, error: 'This claim code was just used by someone else.' };
    }
    throw e;
  }

  return {
    success: true,
    result: {
      username: userData.username,
      email: userData.email,
      wasteType,
      pointsAwarded,
    },
  };
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
