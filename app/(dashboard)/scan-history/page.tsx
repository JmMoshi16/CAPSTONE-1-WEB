'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { Recycle, History, User, CheckCircle, XCircle, Timer, X, ChevronRight, Search } from 'lucide-react';
import { subscribeToQRHistory, loadOlderScans, getScanCounts, type ScanCounts } from '@/lib/firebaseService';
import { WasteType, QRScanRecord } from '@/lib/types';
import { RULES } from '@/lib/rules';
import { fmtAgo, fmtDate, timeOf } from '@/lib/dates';
import { useLoadTimeout } from '@/lib/useLoadTimeout';
import StatPill from '@/components/StatPill';
import LoadError from '@/components/LoadError';

const WASTE_COLORS: Record<WasteType, string> = {
  Biodegradable: '#8BC34A',
  Recyclable: '#29B6F6',
  Residual: '#EF5350',
};
const PAGE_SIZE = 50;   // rows rendered per 'Show more'; the data layer fetches 200 at a time

// One row per phone scan, from qr_scan_history only (audit H-08). Formerly /qr, whose QR-generator
// code was never rendered (audit M-01).
export default function ScanHistoryPage() {
  const [history, setHistory] = useState<QRScanRecord[] | null>(null);   // newest 200, live
  const [older, setOlder] = useState<QRScanRecord[]>([]);                  // fetched on 'Show more'
  const [noMore, setNoMore] = useState(false);
  const [counts, setCounts] = useState<ScanCounts | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<QRScanRecord | null>(null);
  const [search, setSearch] = useState('');
  const [shown, setShown] = useState(PAGE_SIZE);
  const error = useLoadTimeout(history === null);

  useEffect(() => {
    const unsubHistory = subscribeToQRHistory(setHistory);
    return unsubHistory;
  }, []);

  // Totals by server-side count (Phase 9); refreshed whenever a new scan arrives.
  const newest = history?.[0]?.id;
  useEffect(() => { getScanCounts().then(setCounts).catch(e => console.error('[scan counts]', e)); }, [newest]);

  const sorted = useMemo(() => {
    const seen = new Set<string>();
    return [...(history ?? []), ...older]
      .filter(r => (r.id && !seen.has(r.id) ? (seen.add(r.id), true) : !r.id))
      .sort((a, b) => timeOf(b.scannedAt) - timeOf(a.scannedAt));
  }, [history, older]);
  const total = counts?.total ?? sorted.length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(r =>
      (r.scannedByName ?? '').toLowerCase().includes(q) ||
      (r.scannedByEmail ?? '').toLowerCase().includes(q) ||
      (r.wasteType ?? '').toLowerCase().includes(q));
  }, [sorted, search]);

  useEffect(() => { setShown(PAGE_SIZE); }, [search]);

  const showMore = async () => {
    if (shown + PAGE_SIZE > sorted.length && !noMore && !search && sorted.length < total) {
      const more = await loadOlderScans(sorted[sorted.length - 1]?.scannedAt ?? '');
      if (more.length === 0) setNoMore(true);
      setOlder(o => [...o, ...more]);
    }
    setShown(s => s + PAGE_SIZE);
  };

  if (error) return <LoadError what="scan history" />;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-card border border-border rounded-card p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Scan History</h1>
          <div className="px-3 py-1 bg-green/10 border border-green/30 rounded-full">
            <span className="text-green text-xs font-bold">{history === null ? 'Loading…' : `${total} total scans`}</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" aria-hidden />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email or waste type..." aria-label="Search scan history"
            className="w-full bg-card border border-border rounded-btn pl-11 pr-4 py-3 text-white text-sm focus:outline-none focus:border-green transition" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatPill label="Total Scans" value={total} color="#7CCFA5" />
          <StatPill label="Biodegradable" value={counts?.Biodegradable ?? '…'} color={WASTE_COLORS.Biodegradable} />
          <StatPill label="Recyclable" value={counts?.Recyclable ?? '…'} color={WASTE_COLORS.Recyclable} />
          <StatPill label="Residual" value={counts?.Residual ?? '…'} color={WASTE_COLORS.Residual} />
        </div>

        {filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-card p-12 text-center">
            <History className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <p className="text-white/40 font-semibold mb-1">{search ? 'No results found' : history === null ? 'Loading…' : 'No scan history yet'}</p>
            <p className="text-white/30 text-xs">{search ? 'Try a different search term' : 'Scans will appear here once customers use QR codes'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.slice(0, shown).map(record => (
              <ScanHistoryRow key={record.id} record={record} expiryMinutes={RULES.qrExpiryMinutes} onClick={() => setSelectedRecord(record)} />
            ))}
            {(filtered.length > shown || (!search && !noMore && sorted.length < total)) && (
              <button onClick={showMore}
                className="w-full py-3 bg-card border border-border rounded-btn text-white/60 text-sm font-semibold hover:border-green/30 hover:text-white transition">
                Show more ({(search ? filtered.length : total) - Math.min(shown, filtered.length)} not shown)
              </button>
            )}
          </div>
        )}
      </div>

      {selectedRecord && (
        <ScanReceiptDrawer record={selectedRecord} expiryMinutes={RULES.qrExpiryMinutes} onClose={() => setSelectedRecord(null)} />
      )}
    </div>
  );
}

function timing(record: QRScanRecord, expiryMinutes: number) {
  const totalSeconds = Math.max(1, expiryMinutes * 60);
  const after = Math.max(0, record.secondsAfterCreation ?? 0);
  return {
    totalSeconds,
    pct: Math.min(100, Math.round((after / totalSeconds) * 100)),
    mins: Math.floor(after / 60),
    secs: after % 60,
    remaining: totalSeconds - after,
    withinWindow: after <= totalSeconds,
  };
}

interface ScanHistoryRowProps { record: QRScanRecord; expiryMinutes: number; onClick: () => void }
function ScanHistoryRow({ record, expiryMinutes, onClick }: ScanHistoryRowProps) {
  const color = WASTE_COLORS[record.wasteType] ?? '#9E9E9E';
  const { pct, mins, secs } = timing(record, expiryMinutes);

  return (
    <button type="button" onClick={onClick} className="w-full text-left bg-card border border-border hover:border-green/30 rounded-card p-4 flex items-center gap-4 transition">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-white text-sm"
        style={{ background: `linear-gradient(135deg, ${color}99, ${color})` }} aria-hidden>
        {record.scannedByName?.[0]?.toUpperCase() ?? '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-white font-bold text-sm truncate">{record.scannedByName || 'Unknown'}</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0" style={{ backgroundColor: `${color}26`, color }}>{record.wasteType}</span>
        </div>
        <div className="text-white/40 text-xs truncate">{record.scannedByEmail}</div>
        <div className="flex items-center gap-1 mt-1 text-white/30 text-xs">
          <Timer className="w-3 h-3" aria-hidden />{mins}m {secs}s after generation
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-green font-bold text-sm">+{record.pointsAwarded} pts</div>
        <div className="text-white/30 text-xs mt-0.5">{fmtAgo(record.scannedAt)}</div>
        <div className="w-16 bg-white/10 rounded-full h-1 mt-1.5">
          <div className="h-1 rounded-full" style={{ width: `${pct}%`, backgroundColor: pct > 80 ? '#EF5350' : pct > 50 ? '#E2AE68' : '#7CCFA5' }} />
        </div>
        <div className="text-white/20 text-[10px] mt-0.5">{pct}% of window</div>
      </div>
      <ChevronRight className="w-4 h-4 text-white/20 shrink-0" aria-hidden />
    </button>
  );
}

interface ScanReceiptDrawerProps { record: QRScanRecord; expiryMinutes: number; onClose: () => void }
function ScanReceiptDrawer({ record, expiryMinutes, onClose }: ScanReceiptDrawerProps) {
  const color = WASTE_COLORS[record.wasteType] ?? '#9E9E9E';
  const { pct, mins, secs, remaining, withinWindow } = timing(record, expiryMinutes);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-end" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Scan receipt"
        className="w-full max-w-md h-full bg-card border-l border-border overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-white font-bold text-lg">Scan Receipt</h2>
          <button onClick={onClose} aria-label="Close" className="text-white/40 hover:text-white transition"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-bg border border-border rounded-card p-4 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl shrink-0"
              style={{ background: `linear-gradient(135deg, ${color}99, ${color})` }} aria-hidden>
              {record.scannedByName?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0">
              <div className="text-white font-bold truncate">{record.scannedByName || 'Unknown'}</div>
              <div className="text-white/50 text-sm truncate">{record.scannedByEmail}</div>
              <div className="text-white/30 text-xs mt-1 flex items-center gap-1">
                <User className="w-3 h-3" aria-hidden />UID: {(record.scannedByUid ?? '').substring(0, 12)}...
              </div>
            </div>
          </div>

          <div className="bg-white rounded-card overflow-hidden shadow-lg">
            <div className="p-4 text-center" style={{ background: `linear-gradient(135deg, ${color}CC, ${color})` }}>
              <Recycle className="w-6 h-6 text-white mx-auto mb-1" aria-hidden />
              <div className="text-white font-bold">ECOReward Bin</div>
              <div className="text-white/80 text-xs">Scan Receipt</div>
            </div>
            <div className="border-t-2 border-dashed border-gray-200" />
            <div className="p-4 space-y-2.5 text-sm">
              <ReceiptRow label="Waste Type" value={record.wasteType} valueColor={color} />
              <ReceiptRow label="Points Awarded" value={`+${record.pointsAwarded} pts`} valueColor="#5BB287" />
              <ReceiptRow label="Scanned At" value={fmtDate(record.scannedAt, 'MMM d, yyyy h:mm:ss a')} />
              <ReceiptRow label="Token Generated" value={fmtDate(record.tokenCreatedAt, 'MMM d, yyyy h:mm:ss a')} />
              <ReceiptRow label="Token Expires At" value={fmtDate(record.expiresAt, 'h:mm:ss a')} />
              <ReceiptRow label="Token" value={`${(record.token ?? '').substring(0, 8)}…`} />
            </div>
            <div className="border-t-2 border-dashed border-gray-200" />
            <div className="p-4 space-y-2.5 text-sm">
              <div className="text-gray-500 text-xs font-semibold mb-2">TIMING ANALYSIS</div>
              <ReceiptRow label="Time to Scan" value={`${mins}m ${secs}s after generation`} />
              <ReceiptRow label="Time Remaining"
                value={withinWindow ? `${Math.floor(remaining / 60)}m ${remaining % 60}s left` : 'Scanned after expiry'}
                valueColor={withinWindow ? '#5BB287' : '#EF5350'} />
              <ReceiptRow label="Window Used" value={`${pct}% of ${expiryMinutes} min window`} />
              <div className="mt-2">
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: pct > 80 ? '#EF5350' : pct > 50 ? '#E2AE68' : '#5BB287' }} />
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>0:00</span><span>{expiryMinutes}:00</span>
                </div>
              </div>
            </div>
            <div className="border-t-2 border-dashed border-gray-200" />
            <div className="p-3 flex items-center justify-center gap-2">
              {withinWindow
                ? <><CheckCircle className="w-4 h-4 text-green-600" aria-hidden /><span className="text-green-600 text-xs font-bold">Valid Scan — Within Time Window</span></>
                : <><XCircle className="w-4 h-4 text-red-500" aria-hidden /><span className="text-red-500 text-xs font-bold">Scanned After Expiry</span></>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReceiptRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="font-bold text-gray-900 text-right" style={valueColor ? { color: valueColor } : {}}>{value}</span>
    </div>
  );
}
