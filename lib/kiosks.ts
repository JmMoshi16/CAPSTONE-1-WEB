// Pure helpers for the kiosk heartbeat and bin documents, in the shape app.py writes them:
//   kiosks/{kioskId}            { lastSeen, status: 'online'|'offline', name }   every 30 s
//   bins/{kioskId}-bio|rec|res  { location, fillLevel, status, lastUpdated }    on ESP32 FILL lines
// The kiosk always writes bins with status 'online' and only when a fill level changes, so a bin's own
// fields cannot tell whether the kiosk is still running; the heartbeat can.
// Dates arrive as ISO strings ('' when missing): firebaseService normalises them at the boundary.
import type { BinStatus, KioskStatus, WasteType } from './types';

const ageMs = (iso: string, now: Date) => now.getTime() - Date.parse(iso); // NaN when missing

/** Four missed 30 s heartbeats. */
export const HEARTBEAT_STALE_MS = 2 * 60_000;
/** Bins with no kiosk document (older kiosks): same rule as the phone app's staff dashboard. */
export const BIN_STALE_MS = 10 * 60_000;

export function isKioskOnline(k: Pick<KioskStatus, 'status' | 'lastSeen'>, now: Date = new Date()): boolean {
  return k.status === 'online' && ageMs(k.lastSeen, now) <= HEARTBEAT_STALE_MS;
}

export type FillState = 'ok' | 'warn' | 'full';
/** warnPct / fullPct are rules.json `bin_warn_pct` / `bin_full_pct`; at full the kiosk pauses. */
export function fillState(pct: number, warnPct: number, fullPct: number): FillState {
  return pct >= fullPct ? 'full' : pct >= warnPct ? 'warn' : 'ok';
}

const SUFFIX: Record<string, WasteType> = { bio: 'Biodegradable', rec: 'Recyclable', res: 'Residual' };

export interface KioskGroup {
  kioskId: string;
  name: string;
  online: boolean;
  lastSeen: string;          // ISO or ''
  bins: (BinStatus & { wasteType: WasteType | null; fill: number })[];
}

/** One group per kiosk (from both collections), bins in Bio / Rec / Res order. */
export function groupByKiosk(bins: BinStatus[], kiosks: KioskStatus[], now: Date = new Date()): KioskGroup[] {
  const groups = new Map<string, KioskGroup>();
  for (const k of kiosks) {
    groups.set(k.kioskId, { kioskId: k.kioskId, name: k.name || k.kioskId, online: isKioskOnline(k, now), lastSeen: k.lastSeen, bins: [] });
  }
  for (const b of bins) {
    const m = /^(.*)-(bio|rec|res)$/.exec(b.binId);
    const kioskId = m ? m[1] : b.binId;
    let g = groups.get(kioskId);
    if (!g) {
      const online = b.status === 'online' && ageMs(b.lastUpdated, now) <= BIN_STALE_MS;
      g = { kioskId, name: kioskId, online, lastSeen: '', bins: [] };
      groups.set(kioskId, g);
    }
    const fill = Math.max(0, Math.min(100, Math.round(Number(b.fillLevel) || 0)));
    g.bins.push({ ...b, wasteType: m ? SUFFIX[m[2]] : null, fill });
  }
  const order = ['Biodegradable', 'Recyclable', 'Residual'];
  for (const g of groups.values()) g.bins.sort((a, b) => order.indexOf(a.wasteType ?? '') - order.indexOf(b.wasteType ?? ''));
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}
