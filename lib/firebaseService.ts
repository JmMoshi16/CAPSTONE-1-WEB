import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  orderBy,
  runTransaction,
  increment,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { UserModel, WasteLog, Reward, Redemption, BinStatus, AppSettings, DEFAULT_SETTINGS, QRScanRecord } from './types';

// H-07: tolerant timestamp converter — handles Firestore Timestamp objects and ISO string fallback
function _toDateStr(v: unknown): string {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === 'string') return v;
  return new Date().toISOString();
}

// db is only null during SSR — these functions are only called from 'use client' components
// so we assert non-null here. If db is somehow null, Firestore will throw a clear error.
function getDb() {
  if (!db) throw new Error('Firestore not initialized — are you running in a browser?');
  return db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export const subscribeToCustomers = (callback: (users: UserModel[]) => void) => {
  const q = query(collection(getDb(), 'users'), where('role', '==', 'customer'));
  return onSnapshot(q, snapshot => {
    callback(snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as UserModel)));
  });
};

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export const subscribeToLeaderboard = (callback: (users: UserModel[]) => void, limit = 50) => {
  const q = query(
    collection(getDb(), 'users'),
    where('role', '==', 'customer'),
    orderBy('points', 'desc'),
  );
  return onSnapshot(q, snapshot => {
    const users = snapshot.docs
      .map(d => ({ uid: d.id, ...d.data() } as UserModel))
      .slice(0, limit);
    callback(users);
  });
};

// ─── Waste Logs ───────────────────────────────────────────────────────────────

export const subscribeToWasteLogs = (callback: (logs: WasteLog[]) => void) => {
  const q = query(collection(getDb(), 'waste_logs'), orderBy('timestamp', 'desc'));
  return onSnapshot(q, snapshot => {
    callback(snapshot.docs.map(d => {
      const data = d.data();
      return { id: d.id, ...data, timestamp: _toDateStr(data.timestamp) } as WasteLog;  // H-07
    }));
  });
};

// ─── Rewards ──────────────────────────────────────────────────────────────────

export const subscribeToRewards = (callback: (rewards: Reward[]) => void) => {
  return onSnapshot(collection(getDb(), 'rewards'), snapshot => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Reward)));
  });
};

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

export const subscribeToRedemptions = (callback: (redemptions: Redemption[]) => void) => {
  const q = query(collection(getDb(), 'redemptions'), orderBy('redeemedAt', 'desc'));
  return onSnapshot(q, snapshot => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Redemption)));
  });
};

export const markRedemptionClaimed = async (id: string): Promise<void> => {
  await updateDoc(doc(getDb(), 'redemptions', id), { status: 'claimed' });
};

// ─── QR Tokens ────────────────────────────────────────────────────────────────

export const createQRToken = async (token: string, wasteType: string, expiresAt: Date): Promise<string> => {
  const claimCode = String(Math.floor(1000 + Math.random() * 9000));
  await setDoc(doc(getDb(), 'qr_tokens', token), {
    wasteType,
    expiresAt: Timestamp.fromDate(expiresAt),   // H-07
    usedBy: [],
    isUsed: false,
    createdAt: serverTimestamp(),               // H-07
    claimCode,
  });
  return claimCode;
};

// ─── QR Scan History ──────────────────────────────────────────────────────────

export const subscribeToQRHistory = (callback: (records: QRScanRecord[]) => void) => {
  const q = query(collection(getDb(), 'qr_scan_history'), orderBy('scannedAt', 'desc'));
  return onSnapshot(q, snapshot => {
    callback(snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id, ...data,
        scannedAt:      _toDateStr(data.scannedAt),       // H-07
        tokenCreatedAt: _toDateStr(data.tokenCreatedAt),  // H-07
        expiresAt:      _toDateStr(data.expiresAt),       // H-07
      } as QRScanRecord;
    }));
  });
};

// ─── Bins ─────────────────────────────────────────────────────────────────────

export const subscribeToBins = (callback: (bins: BinStatus[]) => void) => {
  return onSnapshot(collection(getDb(), 'bins'), snapshot => {
    callback(snapshot.docs.map(d => ({ binId: d.id, ...d.data() } as BinStatus)));
  });
};

// ─── Settings ─────────────────────────────────────────────────────────────────

export const subscribeToSettings = (callback: (settings: AppSettings) => void) => {
  return onSnapshot(doc(getDb(), 'settings', 'app'), snap => {
    callback(snap.exists() ? (snap.data() as AppSettings) : DEFAULT_SETTINGS);
  });
};

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
  const expiresAt = tokenData.expiresAt ? new Date(tokenData.expiresAt) : null;
  if (expiresAt && new Date() > expiresAt) return { success: false, error: 'This QR token has expired.' };

  const usedBy: string[] = tokenData.usedBy ?? [];
  if (usedBy.includes(userDoc.id)) return { success: false, error: 'This claim code has already been used by this account.' };
  if (usedBy.length > 0) return { success: false, error: 'This claim code has already been used.' };

  const wasteType: string = tokenData.wasteType ?? 'Residual';
  const pointsMap: Record<string, number> = { Biodegradable: 15, Recyclable: 10, Residual: 5 };
  const pointsAwarded = pointsMap[wasteType] ?? 5;

  // Mark token used + credit points + log waste — all in one transaction
  await runTransaction(firestore, async tx => {
    const tokenRef = doc(firestore, 'qr_tokens', matchingToken.id);
    const userRef = doc(firestore, 'users', userDoc.id);
    const logRef = doc(collection(firestore, 'waste_logs'));
    tx.update(tokenRef, { usedBy: [...usedBy, userDoc.id], isUsed: true });
    tx.update(userRef, { points: increment(pointsAwarded) });
    tx.set(logRef, {
      userId: userDoc.id,
      wasteType,
      pointsEarned: pointsAwarded,
      timestamp: new Date().toISOString(),
      binId: matchingToken.id.substring(0, 8),
    });
  });

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
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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
