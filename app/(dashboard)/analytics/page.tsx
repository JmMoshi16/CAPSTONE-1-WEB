'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Line,
  ComposedChart, Cell, PieChart, Pie,
} from 'recharts';
import { subscribeToWasteLogs, subscribeToRecentWasteLogs, subscribeToLeaderboard, getAdminStats, countLogsBetween, type AdminStats } from '@/lib/firebaseService';
import { WasteLog, UserModel, lifetimeOf, creditedOf } from '@/lib/types';
import { toDate } from '@/lib/dates';
import { format, subDays, startOfWeek } from 'date-fns';
import LoadError from '@/components/LoadError';
import {
  BarChart3, TrendingUp, Users, Target, Award, Activity,
  ArrowUpRight, ArrowDownRight, RefreshCw, Zap,
  Clock, Calendar, Recycle,
} from 'lucide-react';
import { useLoadTimeout } from '@/lib/useLoadTimeout';

// ── Types ────────────────────────────────────────────────────────────────────
type TimeRange = '7d' | '30d' | 'all';

// ── Helpers ──────────────────────────────────────────────────────────────────
const COLORS = {
  green:  '#7CCFA5',
  blue:   '#00B0FF',
  orange: '#E2AE68',
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
interface TooltipEntry { name?: string | number; value?: number | string; color?: string }
const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string | number }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1C2520] border border-[#2A342D] rounded-xl p-3 shadow-2xl">
      <p className="text-white/70 text-xs font-semibold mb-2">{label}</p>
      {payload.map(p => (
        <div key={String(p.name)} className="flex items-center gap-2 text-xs">
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
}
function KPICard({ icon: Icon, label, value, sub, change, color }: KPICardProps) {
  const positive = (change ?? 0) >= 0;
  return (
    <div
      className="relative overflow-hidden bg-[#161D18] border border-[#2A342D] rounded-2xl p-5 hover:border-opacity-60 transition-all duration-300 group cursor-default"
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
          <span className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${positive ? 'text-[#7CCFA5] bg-[#7CCFA5]/10' : 'text-[#EF5350] bg-[#EF5350]/10'}`}>
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
    <div className={`bg-[#1C2520] rounded-xl animate-pulse ${className}`} />
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="bg-[#161D18] border border-[#2A342D] rounded-2xl p-6">
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
  // Phase 9: last 31 days of logs (shared with the dashboard), all logs only for 'All time',
  // totals and the previous period by server-side aggregation, top customers from the leaderboard.
  const [recentLogs, setRecentLogs] = useState<WasteLog[] | null>(null);
  const [allLogs, setAllLogs] = useState<WasteLog[] | null>(null);
  const [top, setTop] = useState<UserModel[] | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [prevTotal, setPrevTotal] = useState<number | undefined>(undefined);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    getAdminStats().then(setStats).catch(e => console.error('[analytics stats]', e));
    const u1 = subscribeToRecentWasteLogs(setRecentLogs);
    const u2 = subscribeToLeaderboard(setTop);
    return () => { u1(); u2(); };
  }, []);

  useEffect(() => {
    if (timeRange !== 'all') return;
    return subscribeToWasteLogs(setAllLogs);
  }, [timeRange]);

  useEffect(() => {
    setPrevTotal(undefined);
    const span = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 0;
    if (!span) return;
    const now = new Date();
    countLogsBetween(subDays(now, 2 * span), subDays(now, span)).then(setPrevTotal).catch(() => setPrevTotal(undefined));
  }, [timeRange, lastRefresh]);

  const logs = useMemo(() => (timeRange === 'all' ? allLogs : recentLogs) ?? [], [timeRange, allLogs, recentLogs]);
  const customers = useMemo(() => top ?? [], [top]);
  const loading = !recentLogs || !top || !stats || (timeRange === 'all' && !allLogs);
  const error = useLoadTimeout(loading);

  const handleRefresh = useCallback(() => setLastRefresh(new Date()), []);

  // Single pass over the logs (audit M-02); points are what was credited (audit M-11).
  const data = useMemo(() => {
    const now = new Date();
    const spanDays = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 0;
    const cutoff = spanDays ? subDays(now, spanDays) : new Date(0);
    const weekStart = startOfWeek(now);

    const days = spanDays || 30;
    const dayKeys = Array.from({ length: days }, (_, i) => format(subDays(now, days - 1 - i), 'yyyy-MM-dd'));
    const dayMap = new Map(dayKeys.map(k => [k, { Disposals: 0, Points: 0, users: new Set<string>(), Bio: 0, Rec: 0, Res: 0 }]));
    const hourly = new Array<number>(24).fill(0);
    const waste = { Biodegradable: { value: 0, points: 0 }, Recyclable: { value: 0, points: 0 }, Residual: { value: 0, points: 0 } };
    const perUser = new Map<string, number>(), perUserWeek = new Map<string, number>();
    const active = new Set<string>();
    let total = 0, totalPoints = 0;

    for (const l of logs) {
      const d = toDate(l.timestamp);
      if (!d) continue;
      if (d >= weekStart) perUserWeek.set(l.userId, (perUserWeek.get(l.userId) ?? 0) + 1);
      if (d < cutoff) continue;
      const pts = creditedOf(l);
      total++; totalPoints += pts; active.add(l.userId);
      hourly[d.getHours()]++;
      perUser.set(l.userId, (perUser.get(l.userId) ?? 0) + 1);
      if (l.wasteType in waste) { waste[l.wasteType].value++; waste[l.wasteType].points += pts; }
      const day = dayMap.get(format(d, 'yyyy-MM-dd'));
      if (day) {
        day.Disposals++; day.Points += pts; day.users.add(l.userId);
        if (l.wasteType === 'Biodegradable') day.Bio++; else if (l.wasteType === 'Recyclable') day.Rec++; else if (l.wasteType === 'Residual') day.Res++;
      }
    }

    const dailyTrend = dayKeys.map(k => {
      const { users, ...rest } = dayMap.get(k)!;
      return { date: format(new Date(`${k}T00:00:00`), days === 7 ? 'EEE' : 'MMM d'), ...rest, Users: users.size };
    });
    const hourlyData = hourly.map((count, h) => ({ hour: `${String(h).padStart(2, '0')}h`, count }));
    const peakHour = hourlyData.reduce((m, c) => (c.count > m.count ? c : m), hourlyData[0]);
    const wasteBreakdown = [
      { name: 'Biodegradable', ...waste.Biodegradable, color: COLORS.bio },
      { name: 'Recyclable',    ...waste.Recyclable,    color: COLORS.blue },
      { name: 'Residual',      ...waste.Residual,      color: COLORS.red },
    ];
    const topUsers = customers.slice(0, 8)
      .map(u => ({ ...u, disposals: perUser.get(u.uid) ?? 0, weekDisposals: perUserWeek.get(u.uid) ?? 0 }));

    const activeUsers = active.size;
    return {
      dailyTrend, hourlyData, peakHour, wasteBreakdown, topUsers,
      totalDisposals: total,
      totalPoints,
      engagementRate: (stats?.customers ?? 0) > 0 ? (activeUsers / stats!.customers) * 100 : 0,
      avgPerUser: activeUsers > 0 ? total / activeUsers : 0,
      redemptionRate: total > 0 ? ((stats?.redemptions ?? 0) / total) * 100 : 0,
      growth: spanDays && prevTotal ? ((total - prevTotal) / prevTotal) * 100 : undefined,
      activeUsers,
    };
  }, [logs, customers, stats, prevTotal, timeRange]);

  if (error) return <LoadError what="analytics" />;

  if (loading) return <LoadingSkeleton />;

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="space-y-6 pb-10">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-[#161D18] border border-[#2A342D] rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-forest/60 ring-1 ring-green/25 flex items-center justify-center shrink-0">
              <BarChart3 className="w-7 h-7 text-green" />
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
        <div className="lg:col-span-2 bg-[#161D18] border border-[#2A342D] rounded-2xl p-6 hover:border-[#7CCFA5]/30 transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#7CCFA5]" />
                Performance Trend
              </h3>
              <p className="text-white/40 text-xs mt-1">Disposals, points & active users</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={data.dailyTrend}>
              <defs>
                <linearGradient id="gradDisp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#7CCFA5" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#7CCFA5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A342D" />
              <XAxis dataKey="date" stroke="#F2EDE330" tick={{ fill: '#F2EDE350', fontSize: 11 }} />
              <YAxis stroke="#F2EDE330" tick={{ fill: '#F2EDE350', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#F2EDE360' }} />
              <Area  type="monotone" dataKey="Disposals" stroke="#7CCFA5" strokeWidth={2.5} fill="url(#gradDisp)" />
              <Line  type="monotone" dataKey="Users"     stroke="#00B0FF" strokeWidth={2}   dot={false} />
              <Bar   dataKey="Points" fill="#E2AE68" opacity={0.5} radius={[4,4,0,0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Waste Breakdown Donut */}
        <div className="bg-[#161D18] border border-[#2A342D] rounded-2xl p-6 hover:border-[#00B0FF]/30 transition-all duration-300">
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
                paddingAngle={data.wasteBreakdown.filter(w => w.value > 0).length > 1 ? 3 : 0}
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
        <div className="bg-[#161D18] border border-[#2A342D] rounded-2xl p-6 hover:border-[#E2AE68]/30 transition-all duration-300">
          <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#E2AE68]" />
            Daily Waste Breakdown
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A342D" />
              <XAxis dataKey="date" stroke="#F2EDE330" tick={{ fill: '#F2EDE350', fontSize: 11 }} />
              <YAxis stroke="#F2EDE330" tick={{ fill: '#F2EDE350', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#F2EDE360' }} />
              <Bar dataKey="Bio" stackId="a" fill={COLORS.bio}  name="Bio" />
              <Bar dataKey="Rec" stackId="a" fill={COLORS.blue} name="Rec" />
              <Bar dataKey="Res" stackId="a" fill={COLORS.red}  name="Res" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Hourly Heatmap */}
        <div className="bg-[#161D18] border border-[#2A342D] rounded-2xl p-6 hover:border-[#B388FF]/30 transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#B388FF]" />
              Activity by Hour
            </h3>
            <span className="px-3 py-1 bg-[#E2AE68]/10 border border-[#E2AE68]/30 rounded-full text-[#E2AE68] text-xs font-bold">
              Peak: {data.peakHour.hour}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.hourlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A342D" />
              <XAxis dataKey="hour" stroke="#F2EDE330" tick={{ fill: '#F2EDE350', fontSize: 10 }} interval={2} />
              <YAxis stroke="#F2EDE330" tick={{ fill: '#F2EDE350', fontSize: 11 }} />
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
      <div className="bg-[#161D18] border border-[#2A342D] rounded-2xl p-6 hover:border-[#E2AE68]/30 transition-all duration-300">
        <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-[#E2AE68]" />
          Points Economy Trend
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data.dailyTrend}>
            <defs>
              <linearGradient id="gradPts" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#E2AE68" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#E2AE68" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A342D" />
            <XAxis dataKey="date" stroke="#F2EDE330" tick={{ fill: '#F2EDE350', fontSize: 11 }} />
            <YAxis stroke="#F2EDE330" tick={{ fill: '#F2EDE350', fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="Points" stroke="#E2AE68" strokeWidth={2.5} fill="url(#gradPts)" name="Points" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Top Performers ────────────────────────────────────────────────────── */}
      <div className="bg-[#161D18] border border-[#2A342D] rounded-2xl p-6 hover:border-[#7CCFA5]/20 transition-all duration-300">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-white font-bold text-lg flex items-center gap-2">
            <Award className="w-5 h-5 text-[#7CCFA5]" />
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
                  idx === 0 ? 'bg-[#E2AE68]/20 text-[#E2AE68]' :
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
                        width: `${lifetimeOf(data.topUsers[0] ?? { points: 0 }) > 0 ? (lifetimeOf(user) / lifetimeOf(data.topUsers[0])) * 100 : 0}%`,
                        background: idx === 0 ? COLORS.orange : COLORS.purple,
                      }}
                    />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[#E2AE68] font-bold text-lg" title="lifetime points">{lifetimeOf(user).toLocaleString()}</div>
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
