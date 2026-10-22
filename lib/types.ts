export interface UserModel {
  uid: string;
  username: string;
  email: string;
  role: 'customer' | 'admin';
  points: number;          // spendable balance
  lifetimePoints?: number; // everything ever earned; rank and leaderboard use this (missing on older docs)
  createdAt: string;
  scanCount?: number;
  streak?: number;
  lastScanDate?: string;
  badges?: string[];
}

export const lifetimeOf = (u: Pick<UserModel, 'points' | 'lifetimePoints'>): number =>
  typeof u.lifetimePoints === 'number' ? u.lifetimePoints : u.points ?? 0;

export interface WasteLog {
  id?: string;
  userId: string;
  wasteType: 'Biodegradable' | 'Recyclable' | 'Residual';
  pointsEarned: number;    // base points for the category
  pointsAwarded?: number;  // credited incl. streak bonus (Phase 5); use creditedOf()
  timestamp: string;
  binId: string;
}

export const creditedOf = (l: Pick<WasteLog, 'pointsEarned' | 'pointsAwarded'>): number =>
  typeof l.pointsAwarded === 'number' ? l.pointsAwarded : l.pointsEarned ?? 0;

export interface Reward {
  id?: string;
  title: string;
  description: string;
  pointsCost: number;
  category: 'Coffee' | 'Food' | 'Discount' | 'Other';
  isActive: boolean;
  stock?: number; // -1 or missing = unlimited, 0 = sold out (same meaning as the Flutter app)
}

export interface Redemption {
  id?: string;
  userId: string;
  userEmail: string;
  rewardId: string;
  rewardTitle: string;
  pointsUsed: number;
  redeemedAt: string;
  status: 'pending' | 'claimed';
  redemptionCode: string;
}

// qr_tokens/{uuid} as the kiosk writes it (app.py). Points are not stored: they follow from wasteType.
export interface QRToken {
  id?: string;
  wasteType: 'Biodegradable' | 'Recyclable' | 'Residual';
  claimCode: string;  // 4 digits, shown on the receipt as ECO-dddd
  isUsed: boolean;
  usedBy: string[];
  createdAt: string;
  expiresAt: string;
}

export interface QRScanRecord {
  id?: string;
  token: string;
  wasteType: 'Biodegradable' | 'Recyclable' | 'Residual';
  scannedAt: string;
  scannedByUid: string;
  scannedByName: string;
  scannedByEmail: string;
  pointsAwarded: number;
  tokenCreatedAt: string;
  expiresAt: string;
  // how many seconds after token creation the user scanned (for timing display)
  secondsAfterCreation: number;
}

// bins/{kioskId}-bio|rec|res, written by the kiosk from the ESP32's FILL lines (see lib/kiosks.ts).
export interface BinStatus {
  binId: string;
  location: string;
  fillLevel: number;
  status: 'online' | 'offline';
  lastUpdated: string;
}

// kiosks/{kioskId}: the kiosk's 30 s heartbeat.
export interface KioskStatus {
  kioskId: string;
  name: string;
  status: 'online' | 'offline';
  lastSeen: string;
}

export type WasteType = 'Biodegradable' | 'Recyclable' | 'Residual';
export type RewardCategory = 'Coffee' | 'Food' | 'Discount' | 'Other';
export type SortOption = 'points' | 'disposals' | 'name';
