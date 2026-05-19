export interface UserModel {
  uid: string;
  username: string;
  email: string;
  role: 'customer' | 'admin';
  points: number;
  createdAt: string;
}

export interface WasteLog {
  id?: string;
  userId: string;
  wasteType: 'Biodegradable' | 'Recyclable' | 'Residual';
  pointsEarned: number;
  timestamp: string;
  binId: string;
}

export interface Reward {
  id?: string;
  title: string;
  description: string;
  pointsCost: number;
  category: 'Coffee' | 'Food' | 'Discount' | 'Other';
  isActive: boolean;
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

export interface QRToken {
  id?: string;
  token: string;
  wasteType: 'Biodegradable' | 'Recyclable' | 'Residual';
  expiresAt: string;
  usedBy: string[];
  createdAt: string;
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

export interface BinStatus {
  binId: string;
  location: string;
  fillLevel: number;
  status: 'online' | 'offline';
  lastUpdated: string;
  temperature?: number;
  batteryLevel?: number;
}

export interface AppSettings {
  pointsBiodegradable: number;
  pointsRecyclable: number;
  pointsResidual: number;
  qrExpiryMinutes: number;
  maxBinFillAlert: number;
  updatedAt?: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  pointsBiodegradable: 15,
  pointsRecyclable: 10,
  pointsResidual: 5,
  qrExpiryMinutes: 20,
  maxBinFillAlert: 80,
};

export type WasteType = 'Biodegradable' | 'Recyclable' | 'Residual';
export type RewardCategory = 'Coffee' | 'Food' | 'Discount' | 'Other';
export type SortOption = 'points' | 'disposals' | 'name';
