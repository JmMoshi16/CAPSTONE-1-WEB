'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { Trash2, Wifi, WifiOff, Clock, AlertTriangle, PauseCircle } from 'lucide-react';
import { subscribeToBins, subscribeToKiosks } from '@/lib/firebaseService';
import { BinStatus, KioskStatus } from '@/lib/types';
import { RULES } from '@/lib/rules';
import { groupByKiosk, fillState, type FillState, type KioskGroup } from '@/lib/kiosks';
import { useLoadTimeout } from '@/lib/useLoadTimeout';
import { fmtAgo, fmtDate } from '@/lib/dates';
import LoadError from '@/components/LoadError';

const WARN = RULES.bin_warn_pct;
const FULL = RULES.bin_full_pct;
const FILL_COLOR: Record<FillState, string> = { ok: '#00E676', warn: '#FFAB40', full: '#EF5350' };
const TYPE_COLOR: Record<string, string> = { Biodegradable: '#8BC34A', Recyclable: '#00B0FF', Residual: '#EF5350' };

// One card per kiosk: its heartbeat (kiosks/{id}) and its three bins (bins/{id}-bio|rec|res), in the
// shapes app.py writes. Thresholds are the kiosk's own: warn at bin_warn_pct, pause at bin_full_pct.
export default function BinsPage() {
  const [bins, setBins] = useState<BinStatus[] | null>(null);
  const [kiosks, setKiosks] = useState<KioskStatus[] | null>(null);
  const [now, setNow] = useState(() => new Date());
  const error = useLoadTimeout(bins === null || kiosks === null);

  useEffect(() => {
    const unsubBins = subscribeToBins(setBins);
    const unsubKiosks = subscribeToKiosks(setKiosks);
    // Re-evaluate "online" as heartbeats age, even when no document changes.
    const tick = setInterval(() => setNow(new Date()), 30_000);
    return () => { unsubBins(); unsubKiosks(); clearInterval(tick); };
  }, []);

  if (error) return <LoadError what="bins" />;
  if (bins === null || kiosks === null) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green" />
      </div>
    );
  }

  const groups = groupByKiosk(bins, kiosks, now);
  const online = groups.filter(g => g.online).length;
  const needEmptying = groups.flatMap(g => g.bins).filter(b => fillState(b.fill, WARN, FULL) !== 'ok').length;

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white mb-1">Bin Management</h1>
            <p className="text-white/40 text-sm">Kiosk heartbeat and fill levels from the ESP32 load cells</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="px-3 py-1.5 bg-green/10 border border-green/30 rounded-full">
              <span className="text-green text-xs font-bold">{online}/{groups.length} kiosks online</span>
            </div>
            {needEmptying > 0 && (
              <div className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-full flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-red-500" aria-hidden />
                <span className="text-red-500 text-xs font-bold">{needEmptying} need emptying</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="bg-card border border-border rounded-card p-12 text-center">
          <Trash2 className="w-16 h-16 text-white/20 mx-auto mb-4" aria-hidden />
          <p className="text-white/40 font-semibold mb-2">No kiosks have reported yet</p>
          <p className="text-white/30 text-sm">
            A kiosk appears here once app.py is running: it writes{' '}
            <code className="text-green/70 bg-green/10 px-1.5 py-0.5 rounded text-xs">kiosks</code> every 30 s and{' '}
            <code className="text-green/70 bg-green/10 px-1.5 py-0.5 rounded text-xs">bins</code> when the ESP32 reports fill levels.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {groups.map(g => <KioskCard key={g.kioskId} group={g} />)}
        </div>
      )}
    </div>
  );
}

function KioskCard({ group }: { group: KioskGroup }) {
  const full = group.bins.some(b => fillState(b.fill, WARN, FULL) === 'full');
  return (
    <div className={`bg-card border rounded-card p-5 ${full ? 'border-red-500/40' : 'border-border'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-white font-bold truncate">{group.name}</h2>
          <p className="text-white/40 text-xs flex items-center gap-1.5 mt-0.5">
            <Clock className="w-3 h-3" aria-hidden />
            {group.lastSeen ? `Heartbeat ${fmtAgo(group.lastSeen)}` : 'No heartbeat (older kiosk version)'}
          </p>
        </div>
        <div className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${group.online ? 'bg-green/10 text-green' : 'bg-red-500/10 text-red-500'}`}>
          {group.online ? <Wifi className="w-3 h-3" aria-hidden /> : <WifiOff className="w-3 h-3" aria-hidden />}
          {group.online ? 'Online' : 'Offline'}
        </div>
      </div>

      {full && (
        <p className="mb-4 px-3 py-2 rounded-xl bg-red-500/10 text-red-500 text-xs font-bold flex items-center gap-1.5">
          <PauseCircle className="w-4 h-4" aria-hidden /> A bin is full: the kiosk is paused until it is emptied
        </p>
      )}

      {group.bins.length === 0 ? (
        <p className="text-white/30 text-sm">No fill levels yet. They are sent by the ESP32 after a deposit.</p>
      ) : (
        <div className="space-y-4">
          {group.bins.map(b => {
            const state = fillState(b.fill, WARN, FULL);
            return (
              <div key={b.binId}>
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <span className="text-white/70 text-sm flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: TYPE_COLOR[b.wasteType ?? ''] ?? '#9E9E9E' }} />
                    <span className="truncate">{b.wasteType ?? b.binId}</span>
                  </span>
                  <span className="font-bold tabular-nums flex items-center gap-1.5" style={{ color: FILL_COLOR[state] }}>
                    {state !== 'ok' && <AlertTriangle className="w-3.5 h-3.5" aria-hidden />}
                    {b.fill}%
                    <span className="sr-only">{state === 'full' ? ' full' : state === 'warn' ? ' nearly full' : ''}</span>
                  </span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2.5" role="progressbar" aria-valuenow={b.fill} aria-valuemin={0} aria-valuemax={100}
                  aria-label={`${b.wasteType ?? b.binId} fill level`}>
                  <div className="h-2.5 rounded-full transition-all duration-500" style={{ width: `${b.fill}%`, backgroundColor: FILL_COLOR[state] }} />
                </div>
                <p className="text-white/30 text-[11px] mt-1">Updated {fmtDate(b.lastUpdated, 'MMM d, h:mm a', 'never')}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
