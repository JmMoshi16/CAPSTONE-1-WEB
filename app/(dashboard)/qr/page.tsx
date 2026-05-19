'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Receipt, Clock, RefreshCw, Recycle, History, User, CheckCircle, XCircle, Timer, X, ChevronRight, Search } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { createQRToken, subscribeToSettings, subscribeToQRHistory, subscribeToWasteLogs, subscribeToCustomers } from '@/lib/firebaseService';
import { WasteType, AppSettings, DEFAULT_SETTINGS, QRScanRecord, WasteLog, UserModel } from '@/lib/types';
import { format, formatDistanceToNow } from 'date-fns';

const WASTE_TYPES: { type: WasteType; color: string }[] = [
  { type: 'Biodegradable', color: '#8BC34A' },
  { type: 'Recyclable', color: '#29B6F6' },
  { type: 'Residual', color: '#EF5350' },
];

const WASTE_COLORS: Record<WasteType, string> = {
  Biodegradable: '#8BC34A',
  Recyclable: '#29B6F6',
  Residual: '#EF5350',
};

export default function QRPage() {
  const [activeTab, setActiveTab] = useState<'generator' | 'history'>('generator');
  const [mode, setMode] = useState<'qr' | 'receipt'>('qr');
  const [wasteType, setWasteType] = useState<WasteType>('Recyclable');
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [history, setHistory] = useState<QRScanRecord[]>([]);
  const [wasteLogs, setWasteLogs] = useState<WasteLog[]>([]);
  const [users, setUsers] = useState<UserModel[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<QRScanRecord | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const unsubSettings = subscribeToSettings(setSettings);
    const unsubHistory = subscribeToQRHistory(setHistory);
    const unsubWasteLogs = subscribeToWasteLogs(setWasteLogs);
    const unsubUsers = subscribeToCustomers(setUsers);
    return () => { unsubSettings(); unsubHistory(); unsubWasteLogs(); unsubUsers(); };
  }, []);

  const isExpired = expiresAt ? new Date() > expiresAt : false;

  const handleGenerate = async () => {
    const newToken = uuidv4();
    const expiry = new Date(Date.now() + settings.qrExpiryMinutes * 60 * 1000);
    setToken(newToken);
    setExpiresAt(expiry);
    await createQRToken(newToken, wasteType, expiry);
  };

  const qrData = `ECOBIN:${wasteType}:${token}`;

  const pointsForType: Record<WasteType, number> = {
    Biodegradable: settings.pointsBiodegradable,
    Recyclable: settings.pointsRecyclable,
    Residual: settings.pointsResidual,
  };

  const combinedHistory = [
    ...history,
    ...wasteLogs.map(log => {
      const user = users.find(u => u.uid === log.userId);
      return {
        id: log.id || '',
        token: 'direct-bin-scan',
        wasteType: log.wasteType,
        scannedAt: log.timestamp,
        scannedByUid: log.userId,
        scannedByName: user?.username || 'Unknown User',
        scannedByEmail: user?.email || 'unknown@email.com',
        pointsAwarded: log.pointsEarned,
        tokenCreatedAt: log.timestamp,
        expiresAt: log.timestamp,
        secondsAfterCreation: 0,
      } as QRScanRecord;
    })
  ].sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());

  const filteredHistory = combinedHistory.filter(r =>
    r.scannedByName.toLowerCase().includes(search.toLowerCase()) ||
    r.scannedByEmail.toLowerCase().includes(search.toLowerCase()) ||
    r.wasteType.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-card border border-border rounded-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">QR Generator</h1>
          <div className="px-3 py-1 bg-green/10 border border-green/30 rounded-full">
            <span className="text-green text-xs font-bold">{combinedHistory.length} total scans</span>
          </div>
        </div>
        <div className="flex gap-1 bg-bg rounded-xl p-1">
          <TabBtn icon={QrCode} label="Generator" active={activeTab === 'generator'} onClick={() => setActiveTab('generator')} />
          <TabBtn icon={History} label={`Scan History${combinedHistory.length > 0 ? ` (${combinedHistory.length})` : ''}`} active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
        </div>
      </div>

      {activeTab === 'generator' && (
        <>
          <div className="bg-card border border-border rounded-card p-6">
            <div className="mb-6">
              <h3 className="text-white/70 text-sm font-semibold mb-3">Customer Preference</h3>
              <div className="grid grid-cols-2 gap-3">
                <ModeCard icon={QrCode} title="QR Code" subtitle="Customer scans with phone" active={mode === 'qr'} onClick={() => setMode('qr')} />
                <ModeCard icon={Receipt} title="Paper Receipt" subtitle="No phone / no internet" active={mode === 'receipt'} onClick={() => setMode('receipt')} />
              </div>
            </div>
            <div className="mb-6">
              <h3 className="text-white/70 text-sm font-semibold mb-3">Waste Type</h3>
              <div className="grid grid-cols-3 gap-2">
                {WASTE_TYPES.map(({ type, color }) => (
                  <button key={type} onClick={() => setWasteType(type)}
                    className={`py-3 rounded-btn text-xs font-bold transition ${wasteType === type ? 'border-2' : 'bg-bg border border-border text-white/40'}`}
                    style={wasteType === type ? { backgroundColor: `${color}26`, borderColor: color, color } : {}}>
                    <div>{type}</div>
                    <div className="text-[10px] mt-0.5 opacity-70">+{pointsForType[type]} pts</div>
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handleGenerate} className="w-full bg-green hover:bg-dark-green text-black font-bold py-3 rounded-btn transition flex items-center justify-center gap-2">
              {mode === 'qr' ? <QrCode className="w-5 h-5" /> : <Receipt className="w-5 h-5" />}
              {mode === 'qr' ? 'Generate QR Code' : 'Generate Receipt'}
            </button>
          </div>

          {token ? (
            mode === 'qr' ? (
              <QRDisplay token={qrData} wasteType={wasteType} expiresAt={expiresAt!} isExpired={isExpired} expiryMinutes={settings.qrExpiryMinutes} onRegenerate={handleGenerate} />
            ) : (
              <ReceiptDisplay token={qrData} wasteType={wasteType} points={pointsForType[wasteType]} expiryMinutes={settings.qrExpiryMinutes} />
            )
          ) : (
            <div className="bg-card border border-border rounded-card p-12 text-center">
              {mode === 'qr' ? <QrCode className="w-16 h-16 text-white/20 mx-auto mb-4" /> : <Receipt className="w-16 h-16 text-white/20 mx-auto mb-4" />}
              <p className="text-white/40 text-sm mb-1">{mode === 'qr' ? 'No QR generated yet' : 'No receipt generated yet'}</p>
              <p className="text-white/30 text-xs">Tap the button above to generate</p>
            </div>
          )}
        </>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email or waste type..."
              className="w-full bg-card border border-border rounded-btn pl-11 pr-4 py-3 text-white text-sm focus:outline-none focus:border-green transition" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatPill label="Total Scans" value={combinedHistory.length} color="#00E676" />
            <StatPill label="Biodegradable" value={combinedHistory.filter(r => r.wasteType === 'Biodegradable').length} color="#8BC34A" />
            <StatPill label="Recyclable" value={combinedHistory.filter(r => r.wasteType === 'Recyclable').length} color="#29B6F6" />
          </div>

          {filteredHistory.length === 0 ? (
            <div className="bg-card border border-border rounded-card p-12 text-center">
              <History className="w-16 h-16 text-white/20 mx-auto mb-4" />
              <p className="text-white/40 font-semibold mb-1">{search ? 'No results found' : 'No scan history yet'}</p>
              <p className="text-white/30 text-xs">{search ? 'Try a different search term' : 'Scans will appear here once customers use QR codes'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredHistory.map(record => (
                <ScanHistoryRow key={record.id} record={record} expiryMinutes={settings.qrExpiryMinutes} onClick={() => setSelectedRecord(record)} />
              ))}
            </div>
          )}
        </div>
      )}

      {selectedRecord && (
        <ScanReceiptDrawer record={selectedRecord} expiryMinutes={settings.qrExpiryMinutes} onClose={() => setSelectedRecord(null)} />
      )}
    </div>
  );
}

interface TabBtnProps { icon: React.ElementType; label: string; active: boolean; onClick: () => void }
function TabBtn({ icon: Icon, label, active, onClick }: TabBtnProps) {
  return (
    <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition ${active ? 'bg-card text-green shadow' : 'text-white/40 hover:text-white'}`}>
      <Icon className="w-4 h-4" />{label}
    </button>
  );
}

interface ModeCardProps { icon: React.ElementType; title: string; subtitle: string; active: boolean; onClick: () => void }
function ModeCard({ icon: Icon, title, subtitle, active, onClick }: ModeCardProps) {
  return (
    <button onClick={onClick} className={`p-4 rounded-card border-2 transition ${active ? 'bg-green/10 border-green' : 'bg-card border-border'}`}>
      <Icon className={`w-7 h-7 mx-auto mb-2 ${active ? 'text-green' : 'text-white/40'}`} />
      <div className={`font-bold text-sm mb-1 ${active ? 'text-green' : 'text-white/60'}`}>{title}</div>
      <div className="text-white/30 text-xs">{subtitle}</div>
    </button>
  );
}

interface QRDisplayProps { token: string; wasteType: WasteType; expiresAt: Date; isExpired: boolean; expiryMinutes: number; onRegenerate: () => void }
function QRDisplay({ token, wasteType, expiresAt, isExpired, expiryMinutes, onRegenerate }: QRDisplayProps) {
  return (
    <div className="bg-card border border-border rounded-card p-8 text-center">
      {!isExpired && <CountdownTimer expiresAt={expiresAt} />}
      {isExpired && <div className="flex items-center justify-center gap-2 text-red-500 font-bold mb-4"><Clock className="w-5 h-5" /> QR Expired</div>}
      <div className={`inline-block p-4 bg-white rounded-card mb-4 ${isExpired ? 'opacity-30 grayscale' : ''}`} style={{ boxShadow: isExpired ? 'none' : '0 8px 24px rgba(0,230,118,0.2)' }}>
        <QRCodeSVG value={token} size={200} />
      </div>
      <div className="text-white font-bold mb-2">{wasteType}</div>
      <div className="inline-block px-3 py-1 bg-green/10 border border-green/30 rounded-full text-green text-xs font-bold">Single-use · {expiryMinutes} min expiry</div>
      {isExpired && <button onClick={onRegenerate} className="mt-4 flex items-center gap-2 mx-auto text-green font-bold hover:underline"><RefreshCw className="w-4 h-4" /> Generate New QR</button>}
    </div>
  );
}

interface ReceiptDisplayProps { token: string; wasteType: WasteType; points: number; expiryMinutes: number }
function ReceiptDisplay({ token, wasteType, points, expiryMinutes }: ReceiptDisplayProps) {
  return (
    <div className="bg-white rounded-card overflow-hidden shadow-2xl">
      <div className="bg-gradient-to-br from-green to-dark-green p-6 text-center">
        <Recycle className="w-8 h-8 text-white mx-auto mb-2" />
        <h2 className="text-white font-bold text-lg">ECOReward Bin</h2>
        <p className="text-white/80 text-xs">Smart Waste Recycling System</p>
        <p className="text-white/70 text-xs mt-1">{format(new Date(), 'MMM d, yyyy  h:mm a')}</p>
      </div>
      <div className="border-t-2 border-dashed border-gray-200" />
      <div className="p-6 space-y-3 text-sm">
        <div className="flex justify-between"><span className="text-gray-600">Waste Type</span><span className="font-bold text-gray-900">{wasteType}</span></div>
        <div className="flex justify-between"><span className="text-gray-600">Points to Earn</span><span className="font-bold text-gray-900">+{points} pts</span></div>
        <div className="flex justify-between"><span className="text-gray-600">Status</span><span className="font-bold text-gray-900">Pending Claim</span></div>
        <div className="flex justify-between"><span className="text-gray-600">Valid For</span><span className="font-bold text-gray-900">{expiryMinutes} minutes</span></div>
      </div>
      <div className="border-t-2 border-dashed border-gray-200" />
      <div className="p-6 text-center">
        <p className="text-gray-600 text-xs font-semibold mb-3">Scan QR to Claim Points</p>
        <div className="inline-block p-3 bg-white rounded-xl shadow-lg"><QRCodeSVG value={token} size={180} /></div>
        <div className="mt-4 p-3 bg-green/10 border border-green/30 rounded-xl">
          <p className="text-green text-xs">Customer can scan this QR with the ECOReward app to claim their points. Valid for {expiryMinutes} minutes.</p>
        </div>
      </div>
      <div className="border-t-2 border-dashed border-gray-200" />
      <div className="bg-gray-50 p-4 text-center"><p className="text-gray-500 text-xs">Thank you for helping the environment! 🌍</p></div>
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-card border rounded-card p-3 text-center" style={{ borderColor: `${color}33`, backgroundColor: `${color}0D` }}>
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-white/40 text-xs mt-0.5">{label}</div>
    </div>
  );
}

interface ScanHistoryRowProps { record: QRScanRecord; expiryMinutes: number; onClick: () => void }
function ScanHistoryRow({ record, expiryMinutes, onClick }: ScanHistoryRowProps) {
  const color = WASTE_COLORS[record.wasteType];
  const totalSeconds = expiryMinutes * 60;
  const pct = Math.min(100, Math.round((record.secondsAfterCreation / totalSeconds) * 100));
  const mins = Math.floor(record.secondsAfterCreation / 60);
  const secs = record.secondsAfterCreation % 60;

  return (
    <div onClick={onClick} className="bg-card border border-border hover:border-green/30 rounded-card p-4 flex items-center gap-4 cursor-pointer transition">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-white text-sm"
        style={{ background: `linear-gradient(135deg, ${color}99, ${color})` }}>
        {record.scannedByName?.[0]?.toUpperCase() ?? '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-white font-bold text-sm truncate">{record.scannedByName}</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0" style={{ backgroundColor: `${color}26`, color }}>{record.wasteType}</span>
        </div>
        <div className="text-white/40 text-xs truncate">{record.scannedByEmail}</div>
        <div className="flex items-center gap-1 mt-1 text-white/30 text-xs">
          <Timer className="w-3 h-3" />{mins}m {secs}s after generation
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-green font-bold text-sm">+{record.pointsAwarded} pts</div>
        <div className="text-white/30 text-xs mt-0.5">{formatDistanceToNow(new Date(record.scannedAt), { addSuffix: true })}</div>
        <div className="w-16 bg-white/10 rounded-full h-1 mt-1.5">
          <div className="h-1 rounded-full" style={{ width: `${pct}%`, backgroundColor: pct > 80 ? '#EF5350' : pct > 50 ? '#FFAB40' : '#00E676' }} />
        </div>
        <div className="text-white/20 text-[10px] mt-0.5">{pct}% of window</div>
      </div>
      <ChevronRight className="w-4 h-4 text-white/20 shrink-0" />
    </div>
  );
}

interface ScanReceiptDrawerProps { record: QRScanRecord; expiryMinutes: number; onClose: () => void }
function ScanReceiptDrawer({ record, expiryMinutes, onClose }: ScanReceiptDrawerProps) {
  const color = WASTE_COLORS[record.wasteType];
  const totalSeconds = expiryMinutes * 60;
  const pct = Math.min(100, Math.round((record.secondsAfterCreation / totalSeconds) * 100));
  const mins = Math.floor(record.secondsAfterCreation / 60);
  const secs = record.secondsAfterCreation % 60;
  const remaining = totalSeconds - record.secondsAfterCreation;
  const remainMins = Math.floor(remaining / 60);
  const remainSecs = remaining % 60;
  const withinWindow = record.secondsAfterCreation <= totalSeconds;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-end" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-card border-l border-border overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-white font-bold text-lg">Scan Receipt</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* User card */}
          <div className="bg-bg border border-border rounded-card p-4 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl shrink-0"
              style={{ background: `linear-gradient(135deg, ${color}99, ${color})` }}>
              {record.scannedByName?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0">
              <div className="text-white font-bold truncate">{record.scannedByName}</div>
              <div className="text-white/50 text-sm truncate">{record.scannedByEmail}</div>
              <div className="text-white/30 text-xs mt-1 flex items-center gap-1">
                <User className="w-3 h-3" />UID: {record.scannedByUid.substring(0, 12)}...
              </div>
            </div>
          </div>

          {/* Receipt */}
          <div className="bg-white rounded-card overflow-hidden shadow-lg">
            <div className="p-4 text-center" style={{ background: `linear-gradient(135deg, ${color}CC, ${color})` }}>
              <Recycle className="w-6 h-6 text-white mx-auto mb-1" />
              <div className="text-white font-bold">ECOReward Bin</div>
              <div className="text-white/80 text-xs">Scan Receipt</div>
            </div>
            <div className="border-t-2 border-dashed border-gray-200" />
            <div className="p-4 space-y-2.5 text-sm">
              <ReceiptRow label="Waste Type" value={record.wasteType} valueColor={color} />
              <ReceiptRow label="Points Awarded" value={`+${record.pointsAwarded} pts`} valueColor="#00C853" />
              <ReceiptRow label="Scanned At" value={format(new Date(record.scannedAt), 'MMM d, yyyy h:mm:ss a')} />
              <ReceiptRow label="Token Generated" value={format(new Date(record.tokenCreatedAt), 'MMM d, yyyy h:mm:ss a')} />
              <ReceiptRow label="Token Expired At" value={format(new Date(record.expiresAt), 'h:mm:ss a')} />
            </div>
            <div className="border-t-2 border-dashed border-gray-200" />
            <div className="p-4 space-y-2.5 text-sm">
              <div className="text-gray-500 text-xs font-semibold mb-2">TIMING ANALYSIS</div>
              <ReceiptRow label="Time to Scan" value={`${mins}m ${secs}s after generation`} />
              <ReceiptRow label="Time Remaining" value={withinWindow ? `${remainMins}m ${remainSecs}s left` : 'Scanned after expiry'} valueColor={withinWindow ? '#00C853' : '#EF5350'} />
              <ReceiptRow label="Window Used" value={`${pct}% of ${expiryMinutes} min window`} />
              <div className="mt-2">
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: pct > 80 ? '#EF5350' : pct > 50 ? '#FFAB40' : '#00C853' }} />
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>0:00</span><span>{expiryMinutes}:00</span>
                </div>
              </div>
            </div>
            <div className="border-t-2 border-dashed border-gray-200" />
            <div className="p-3 flex items-center justify-center gap-2">
              {withinWindow
                ? <><CheckCircle className="w-4 h-4 text-green-600" /><span className="text-green-600 text-xs font-bold">Valid Scan — Within Time Window</span></>
                : <><XCircle className="w-4 h-4 text-red-500" /><span className="text-red-500 text-xs font-bold">Scanned After Expiry</span></>}
            </div>
          </div>

          {/* Token QR */}
          <div className="bg-bg border border-border rounded-card p-4 text-center">
            <p className="text-white/40 text-xs mb-3">Token QR Code</p>
            <div className="inline-block p-3 bg-white rounded-xl">
              <QRCodeSVG value={`ECOBIN:${record.wasteType}:${record.token}`} size={120} />
            </div>
            <p className="text-white/20 text-[10px] mt-2 font-mono break-all">{record.token}</p>
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

function CountdownTimer({ expiresAt }: { expiresAt: Date }) {
  const [remaining, setRemaining] = useState(expiresAt.getTime() - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const diff = expiresAt.getTime() - Date.now();
      setRemaining(diff <= 0 ? 0 : diff);
      if (diff <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const isLow = remaining < 60000;

  return (
    <div className={`flex items-center justify-center gap-2 mb-4 font-bold ${isLow ? 'text-red-500' : 'text-green'}`}>
      <Clock className="w-4 h-4" />
      Expires in {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </div>
  );
}
