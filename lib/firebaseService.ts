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
} from 'firebase/firestore';
import { db } from './firebase';
import { UserModel, WasteLog, Reward, Redemption, BinStatus, AppSettings, DEFAULT_SETTINGS, QRScanRecord } from './types';

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

// ─── Waste Logs ───────────────────────────────────────────────────────────────

export const subscribeToWasteLogs = (callback: (logs: WasteLog[]) => void) => {
  const q = query(collection(getDb(), 'waste_logs'), orderBy('timestamp', 'desc'));
  return onSnapshot(q, snapshot => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as WasteLog)));
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

export const createQRToken = async (token: string, wasteType: string, expiresAt: Date): Promise<void> => {
  // IMPORTANT: The document ID MUST be the token UUID.
  // Flutter's validateAndUseQRToken does: db.collection('qr_tokens').doc(token)
  // If we use addDoc (auto-ID), Flutter will never find the document → always "Invalid QR".
  await setDoc(doc(getDb(), 'qr_tokens', token), {
    wasteType,
    expiresAt: expiresAt.toISOString(),
    usedBy: [],
    createdAt: new Date().toISOString(),
  });
};

// ─── QR Scan History ──────────────────────────────────────────────────────────

export const subscribeToQRHistory = (callback: (records: QRScanRecord[]) => void) => {
  const q = query(collection(getDb(), 'qr_scan_history'), orderBy('scannedAt', 'desc'));
  return onSnapshot(q, snapshot => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as QRScanRecord)));
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
