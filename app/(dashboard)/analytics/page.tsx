'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, LineChart, Line,
  ComposedChart, Cell, PieChart, Pie,
} from 'recharts';
import { subscribeToWasteLogs, subscribeToCustomers, subscribeToRedemptions } from '@/lib/firebaseService';
import { WasteLog, UserModel, Redemption } from '@/lib/types';
import {
  format, subDays, startOfWeek, startOfMonth, getHours,
} from 'date-fns';
import {
  BarChart3, TrendingUp, Users, Target, Award, Activity,
  ArrowUpRight, ArrowDownRight, Download, RefreshCw, Zap,
  Clock, Calendar, Leaf, Recycle, Trash2, Star,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
type TimeRange = '7d' | '30d' | 'all';

// ── Helpers ──────────────────────────────────────────────────────────────────
const COLORS = {
  green:  '#00E676',
  blue:   '#00B0FF',
  orange: '#FFAB40',
  purple: '#B388FF',
  red:    '#EF5350',
  bio:    '#8BC34A',
  rec:    '#29B6F6',
  res:    '#EF5350',
};

function pct(value: number, total: number) {
  return total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1C2128] border border-[#30363D] rounded-xl p-3 shadow-2xl">
      <p className="text-white/70 text-xs font-semibold mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-white/60">{p.name}:</span>
          <span className="text-white font-bold">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ── KPI Card ─────────────────────────────────────────────────────────────────
interface KPICardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  change?: number;
  color: string;
  gradient?: string;
}
function KPICard({ icon: Icon, label, value, sub, change, color, gradient }: KPICardProps) {
  const positive = (change ?? 0) >= 0;
  return (
    <div
      className="relative overflow-hidden bg-[#161B22] border border-[#30363D] rounded-2xl p-5 hover:border-opacity-60 transition-all duration-300 group cursor-default"
      style={{ '--hover-color': color } as React.CSSProperties}
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at top left, ${color}12 0%, transparent 60%)` }}
      />
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300"
          style={{ background: `${color}20` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        {change !== undefined && (
          <span className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${positive ? 'text-[#00E676] bg-[#00E676]/10' : 'text-[#EF5350] bg-[#EF5350]/10'}`}>
            {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      <div className="text-white/50 text-xs font-medium">{label}</div>
      {sub && <div className="text-white/30 text-xs mt-1">{sub}</div>}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-[#1C2128] rounded-xl animate-pulse ${className}`} />
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="w-14 h-14 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="w-48 h-6" />
            <Skeleton className="w-64 h-4" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="lg:col-span-2 h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [logs, setLogs] = useState<WasteLog[]>([]);
  const [customers, setCustomers] = useState<UserModel[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [ready, setReady] = useState({ logs: false, customers: false, redemptions: false });
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    const u1 = subscribeToWasteLogs(d => { setLogs(d); setReady(r => ({ ...r, logs: true })); });
    const u2 = subscribeToCustomers(d => { setCustomers(d); setReady(r => ({ ...r, customers: true })); });
    const u3 = subscribeToRedemptions(d => { setRedemptions(d); setReady(r => ({ ...r, redemptions: true })); });
    return () => { u1(); u2(); u3(); };
  }, []);

  const loading = !ready.logs || !ready.customers || !ready.redemptions;

  const handleRefresh = useCallback(() => setLastRefresh(new Date()), []);

  const data = useMemo(() => {
    const now = new Date();
    const cutoff = timeRange === '7d'
      ? subDays(now, 7)
      : timeRange === '30d'
        ? subDays(now, 30)
        : new Date(0);

    const filtered = logs.filter(l => new Date(l.timestamp) >= cutoff);
    const weekLogs  = logs.filter(l => new Date(l.timestamp) >= startOfWeek(now));
    const monthLogs = logs.filter(l => new Date(l.timestamp) >= startOfMonth(now));
    const prev = logs.filter(l => {
      const t = new Date(l.timestamp);
      return t >= subDays(cutoff, cutoff.getTime() === 0 ? 0 : (now.getTime() - cutoff.getTime()) / 86400000) && t < cutoff;
    });

    // Daily trend
    const days = timeRange === '7d' ? 7 : 30;
    const dailyTrend = Array.from({ length: days }, (_, i) => {
      const date = subDays(now, days - 1 - i);
      const dayStr = format(date, 'yyyy-MM-dd');
      const dl = filtered.filter(l => format(new Date(l.timestamp), 'yyyy-MM-dd') === dayStr);
      return {
        date: format(date, days === 7 ? 'EEE' : 'MMM d'),
        Disposals: dl.length,
        Points: dl.reduce((s, l) => s + l.pointsEarned, 0),
        Users: new Set(dl.map(l => l.userId)).size,
        Bio: dl.filter(l => l.wasteType === 'Biodegradable').length,
        Rec: dl.filter(l => l.wasteType === 'Recyclable').length,
        Res: dl.filter(l => l.wasteType === 'Residual').length,
      };
    });

    // Hourly
    const hourlyData = Array.from({ length: 24 }, (_, h) => {
      const count = filtered.filter(l => getHours(new Date(l.timestamp)) === h).length;
      return { hour: `${String(h).padStart(2, '0')}h`, count };
    });
    const peakHour = hourlyData.reduce((m, c) => c.count > m.count ? c : m, hourlyData[0]);

    // Waste breakdown
    const bio = filtered.filter(l => l.wasteType === 'Biodegradable');
    const rec = filtered.filter(l => l.wasteType === 'Recyclable');
    const res = filtered.filter(l => l.wasteType === 'Residual');
    const wasteBreakdown = [
      { name: 'Biodegradable', value: bio.length, points: bio.reduce((s,l)=>s+l.pointsEarned,0), color: COLORS.bio },
      { name: 'Recyclable',    value: rec.length, points: rec.reduce((s,l)=>s+l.pointsEarned,0), color: COLORS.blue },
      { name: 'Residual',      value: res.length, points: res.reduce((s,l)=>s+l.pointsEarned,0), color: COLORS.red },
    ];

    // Top users
    const topUsers = customers
      .map(u => ({
        ...u,
        disposals: filtered.filter(l => l.userId === u.uid).length,
        weekDisposals: weekLogs.filter(l => l.userId === u.uid).length,
      }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 8);

    // KPIs
    const activeUsers = new Set(filtered.map(l => l.userId)).size;
    const engagementRate = customers.length > 0 ? (activeUsers / customers.length) * 100 : 0;
    const avgPerUser = activeUsers > 0 ? filtered.length / activeUsers : 0;
    const redemptionRate = filtered.length > 0 ? (redemptions.length / filtered.length) * 100 : 0;
    const totalPoints = filtered.reduce((s, l) => s + l.pointsEarned, 0);

    // Growth
    const growth = prev.length > 0 ? ((filtered.length - prev.length) / prev.length) * 100 : 0;

    return {
      dailyTrend, hourlyData, peakHour, wasteBreakdown, topUsers,
      totalDisposals: filtered.length,
      totalPoints,
      engagementRate,
      avgPerUser,
      redemptionRate,
      growth,
      activeUsers,
    };
  }, [logs, customers, redemptions, timeRange]);

  if (loading) return <LoadingSkeleton />;

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="space-y-6 pb-10">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/80 to-[#B388FF]/50 flex items-center justify-center shadow-xl shadow-purple-500/20">
              <BarChart3 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Advanced Analytics</h1>
              <p className="text-white/40 text-sm flex items-center gap-2 mt-0.5">
                <Activity className="w-3.5 h-3.5 text-[#B388FF] animate-pulse" />
                Live · Updated {format(lastRefresh, 'h:mm:ss a')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(['7d', '30d', 'all'] as TimeRange[]).map(r => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  timeRange === r
                    ? 'bg-[#B388FF] text-white shadow-lg shadow-purple-500/30'
                    : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                }`}
              >
                {r === 'all' ? 'All time' : r}
              </button>
            ))}
            <button
              onClick={handleRefresh}
              className="p-2 bg-white/5 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard icon={Target}    label="Total Disposals"  value={data.totalDisposals}            change={data.growth}     color={COLORS.purple} />
          <KPICard icon={Zap}       label="Total Points"     value={data.totalPoints.toLocaleString()} sub="Eco-points earned" color={COLORS.orange} />
          <KPICard icon={Users}     label="Engagement Rate"  value={`${data.engagementRate.toFixed(1)}%`} sub={`${data.activeUsers} active users`} color={COLORS.green} />
          <KPICard icon={TrendingUp} label="Redemption Rate" value={`${data.redemptionRate.toFixed(1)}%`} sub={`${data.avgPerUser.toFixed(1)} disp/user`} color={COLORS.blue} />
        </div>
      </div>

      {/* ── Main Charts ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Chart */}
        <div className="lg:col-span-2 bg-[#161B22] border border-[#30363D] rounded-2xl p-6 hover:border-[#00E676]/30 transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#00E676]" />
                Performance Trend
              </h3>
              <p className="text-white/40 text-xs mt-1">Disposals, points & active users</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={data.dailyTrend}>
              <defs>
                <linearGradient id="gradDisp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#00E676" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#00E676" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#30363D" />
              <XAxis dataKey="date" stroke="#ffffff30" tick={{ fill: '#ffffff50', fontSize: 11 }} />
              <YAxis stroke="#ffffff30" tick={{ fill: '#ffffff50', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#ffffff60' }} />
              <Area  type="monotone" dataKey="Disposals" stroke="#00E676" strokeWidth={2.5} fill="url(#gradDisp)" />
              <Line  type="monotone" dataKey="Users"     stroke="#00B0FF" strokeWidth={2}   dot={false} />
              <Bar   dataKey="Points" fill="#FFAB40" opacity={0.5} radius={[4,4,0,0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Waste Breakdown Donut */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-6 hover:border-[#00B0FF]/30 transition-all duration-300">
          <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
            <Recycle className="w-5 h-5 text-[#00B0FF]" />
            Waste Distribution
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={data.wasteBreakdown}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {data.wasteBreakdown.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-3 mt-2">
            {data.wasteBreakdown.map(item => (
              <div key={item.name} className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: item.color }} />
                <span className="text-white/70 text-xs flex-1">{item.name}</span>
                <span className="text-white font-bold text-sm">{item.value}</span>
                <span className="text-white/30 text-xs w-12 text-right">
                  {pct(item.value, data.totalDisposals)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Secondary Charts ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stacked Bar */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-6 hover:border-[#FFAB40]/30 transition-all duration-300">
          <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#FFAB40]" />
            Daily Waste Breakdown
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#30363D" />
              <XAxis dataKey="date" stroke="#ffffff30" tick={{ fill: '#ffffff50', fontSize: 11 }} />
              <YAxis stroke="#ffffff30" tick={{ fill: '#ffffff50', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#ffffff60' }} />
              <Bar dataKey="Bio" stackId="a" fill={COLORS.bio}  name="Bio" />
              <Bar dataKey="Rec" stackId="a" fill={COLORS.blue} name="Rec" />
              <Bar dataKey="Res" stackId="a" fill={COLORS.red}  name="Res" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Hourly Heatmap */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-6 hover:border-[#B388FF]/30 transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#B388FF]" />
              Activity by Hour
            </h3>
            <span className="px-3 py-1 bg-[#FFAB40]/10 border border-[#FFAB40]/30 rounded-full text-[#FFAB40] text-xs font-bold">
              Peak: {data.peakHour.hour}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.hourlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#30363D" />
              <XAxis dataKey="hour" stroke="#ffffff30" tick={{ fill: '#ffffff50', fontSize: 10 }} interval={2} />
              <YAxis stroke="#ffffff30" tick={{ fill: '#ffffff50', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Scans" radius={[4,4,0,0]}>
                {data.hourlyData.map((e, i) => (
                  <Cell key={i} fill={e.count === data.peakHour.count ? COLORS.orange : COLORS.purple} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Points Trend ─────────────────────────────────────────────────────── */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-6 hover:border-[#FFAB40]/30 transition-all duration-300">
        <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-[#FFAB40]" />
          Points Economy Trend
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data.dailyTrend}>
            <defs>
              <linearGradient id="gradPts" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#FFAB40" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#FFAB40" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#30363D" />
            <XAxis dataKey="date" stroke="#ffffff30" tick={{ fill: '#ffffff50', fontSize: 11 }} />
            <YAxis stroke="#ffffff30" tick={{ fill: '#ffffff50', fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="Points" stroke="#FFAB40" strokeWidth={2.5} fill="url(#gradPts)" name="Points" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Top Performers ────────────────────────────────────────────────────── */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-6 hover:border-[#00E676]/20 transition-all duration-300">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-white font-bold text-lg flex items-center gap-2">
            <Award className="w-5 h-5 text-[#00E676]" />
            Top Performers Leaderboard
          </h3>
          <span className="text-white/30 text-xs">Ranked by eco-points</span>
        </div>
        {data.topUsers.length === 0 ? (
          <div className="text-center py-12 text-white/30">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No user data yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.topUsers.map((user, idx) => (
              <div
                key={user.uid}
                className="flex items-center gap-4 p-4 bg-white/[0.03] rounded-xl hover:bg-white/[0.07] transition-all duration-200 group border border-transparent hover:border-white/10"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm group-hover:scale-110 transition-transform ${
                  idx === 0 ? 'bg-[#FFAB40]/20 text-[#FFAB40]' :
                  idx === 1 ? 'bg-white/10 text-white/70' :
                  idx === 2 ? 'bg-[#8BC34A]/20 text-[#8BC34A]' :
                  'bg-white/5 text-white/40'
                }`}>
                  {idx < 3 ? medals[idx] : `#${idx + 1}`}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-semibold text-sm truncate">{user.username}</div>
                  <div className="text-white/40 text-xs">{user.disposals} total · {user.weekDisposals} this week</div>
                  <div className="w-full bg-white/10 rounded-full h-1 mt-2">
                    <div
                      className="h-1 rounded-full transition-all duration-700"
                      style={{
                        width: `${data.topUsers[0]?.points > 0 ? (user.points / data.topUsers[0].points) * 100 : 0}%`,
                        background: idx === 0 ? COLORS.orange : COLORS.purple,
                      }}
                    />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[#FFAB40] font-bold text-lg">{user.points.toLocaleString()}</div>
                  <div className="text-white/30 text-xs">pts</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
