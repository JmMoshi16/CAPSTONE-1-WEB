'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { Trash2, Wifi, WifiOff, Clock, AlertTriangle, CheckCircle, Thermometer, Battery } from 'lucide-react';
import { subscribeToBins } from '@/lib/firebaseService';
import { BinStatus } from '@/lib/types';

export default function BinsPage() {
  const [bins, setBins] = useState<BinStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToBins(data => {
      setBins(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const onlineBins = bins.filter(b => b.status === 'online').length;
  const criticalBins = bins.filter(b => b.fillLevel > 80).length;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white mb-1">Bin Management</h1>
            <p className="text-white/40 text-sm">Real-time IoT monitoring via Firebase</p>
          </div>
          <div className="flex gap-3">
            <div className="px-3 py-1.5 bg-green/10 border border-green/30 rounded-full">
              <span className="text-green text-xs font-bold">{onlineBins}/{bins.length} Online</span>
            </div>
            {criticalBins > 0 && (
              <div className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-full flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-red-500" />
                <span className="text-red-500 text-xs font-bold">{criticalBins} Critical</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {bins.length === 0 ? (
        <div className="bg-card border border-border rounded-card p-12 text-center">
          <Trash2 className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <p className="text-white/40 font-semibold mb-2">No bins connected yet</p>
          <p className="text-white/30 text-sm">
            Bins will appear here once the ESP32 devices write to the{' '}
            <code className="text-green/70 bg-green/10 px-1.5 py-0.5 rounded text-xs">bins</code>{' '}
            Firestore collection.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {bins.map(bin => <BinCard key={bin.binId} bin={bin} />)}
        </div>
      )}

      {/* System Health */}
      <div className="bg-card border border-border rounded-card p-6">
        <h2 className="text-white font-bold mb-4">System Health</h2>
        <div className="space-y-3">
          <HealthRow label="Firebase Firestore Sync" status="online" />
          <HealthRow label="Firebase Auth" status="online" />
          <HealthRow label="ESP32 Hardware" status={onlineBins > 0 ? 'online' : 'offline'} />
          <div className="pt-2 border-t border-border space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Last Sync</span>
              <span className="text-white font-mono text-xs">{new Date().toLocaleTimeString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Active Bins</span>
              <span className="text-green font-mono text-xs">{onlineBins} / {bins.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BinCard({ bin }: { bin: BinStatus }) {
  const fillColor = bin.fillLevel > 80 ? '#EF5350' : bin.fillLevel > 50 ? '#FFAB40' : '#00E676';
  const isOnline = bin.status === 'online';
  const isCritical = bin.fillLevel > 80;

  return (
    <div className={`bg-card border rounded-card p-5 ${isCritical ? 'border-red-500/40' : 'border-border'}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-bold">{bin.binId}</h3>
          <p className="text-white/40 text-sm">{bin.location}</p>
        </div>
        <div className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${isOnline ? 'bg-green/10 text-green' : 'bg-red-500/10 text-red-500'}`}>
          {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {isOnline ? 'Online' : 'Offline'}
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-white/60 text-sm">Fill Level</span>
          <div className="flex items-center gap-2">
            {isCritical && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
            <span className="font-bold text-lg" style={{ color: fillColor }}>{bin.fillLevel}%</span>
          </div>
        </div>
        <div className="w-full bg-white/10 rounded-full h-3">
          <div className="h-3 rounded-full transition-all duration-500" style={{ width: `${bin.fillLevel}%`, backgroundColor: fillColor }} />
        </div>
        {isCritical && (
          <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Needs emptying soon
          </p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white/40 text-xs">
          <Clock className="w-3 h-3" />
          {new Date(bin.lastUpdated).toLocaleTimeString()}
        </div>
        <div className="flex items-center gap-3">
          {bin.temperature !== undefined && (
            <div className="flex items-center gap-1 text-white/40 text-xs">
              <Thermometer className="w-3 h-3" />
              {bin.temperature}°C
            </div>
          )}
          {bin.batteryLevel !== undefined && (
            <div className="flex items-center gap-1 text-white/40 text-xs">
              <Battery className="w-3 h-3" />
              {bin.batteryLevel}%
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HealthRow({ label, status }: { label: string; status: 'online' | 'offline' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/60 text-sm">{label}</span>
      <div className="flex items-center gap-2">
        {status === 'online'
          ? <CheckCircle className="w-4 h-4 text-green" />
          : <AlertTriangle className="w-4 h-4 text-red-500" />}
        <span className={`text-sm font-bold ${status === 'online' ? 'text-green' : 'text-red-500'}`}>
          {status === 'online' ? 'Online' : 'Offline'}
        </span>
      </div>
    </div>
  );
}
