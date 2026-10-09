'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo, type ElementType } from 'react';
import Link from 'next/link';
import { Recycle, Users, Star, Receipt, TrendingUp, TrendingDown, Clock, Activity, ArrowUpRight, ArrowDownRight, Target, Award, Leaf, BarChart3, Trophy } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { subscribeToCustomers, subscribeToWasteLogs, subscribeToRedemptions } from '@/lib/firebaseService';
import { UserModel, WasteLog, Redemption, WasteType, lifetimeOf, creditedOf } from '@/lib/types';
import { toDate } from '@/lib/dates';
import { format, subDays, startOfDay, isToday, isYesterday, startOfWeek, startOfMonth } from 'date-fns';
import { useLoadTimeout } from '@/lib/useLoadTimeout';
import LoadError from '@/components/LoadError';

type TimeRange = 'today' | 'week' | 'month' | 'all';
const TIME_RANGES: TimeRange[] = ['today', 'week', 'month', 'all'];
const WASTE_COLORS: Record<WasteType, string> = { Biodegradable: '#8BC34A', Recyclable: '#00B0FF', Residual: '#EF5350' };

export default function DashboardPage() {
  const [customers, setCustomers] = useState<UserModel[]>([]);
  const [logs, setLogs] = useState<WasteLog[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [ready, setReady] = useState({ customers: false, logs: false, redemptions: false });
  const [timeRange, setTimeRange] = useState<TimeRange>('week');

  useEffect(() => {
    const unsubCustomers = subscribeToCustomers(data => {
      setCustomers(data);
      setReady(r => ({ ...r, customers: true }));
    });
    const unsubLogs = subscribeToWasteLogs(data => {
      setLogs(data);
      setReady(r => ({ ...r, logs: true }));
    });
    const unsubRedemptions = subscribeToRedemptions(data => {
      setRedemptions(data);
      setReady(r => ({ ...r, redemptions: true }));
    });
    return () => { unsubCustomers(); unsubLogs(); unsubRedemptions(); };
  }, []);

  const loading = !ready.customers || !ready.logs || !ready.redemptions;
  const error = useLoadTimeout(loading);

  // One pass over the logs builds every number on this page (audit M-02: this used to filter all
  // logs ~10 times plus once per hour, per day and per customer). Points are what was credited.
  const analytics = useMemo(() => {
    const now = new Date();
    const cutoff = timeRange === 'today'
      ? startOfDay(now)
      : timeRange === 'week'
        ? startOfWeek(now)
        : timeRange === 'month'
          ? startOfMonth(now)
          : new Date(0);
    const weekStart = startOfWeek(now);

    const dayKeys = Array.from({ length: 14 }, (_, i) => format(subDays(now, 13 - i), 'yyyy-MM-dd'));
    const days = new Map(dayKeys.map(k => [k, { disposals: 0, points: 0, users: new Set<string>() }]));
    const hourly = new Array<number>(24).fill(0);
    const typeCount: Record<WasteType, number> = { Biodegradable: 0, Recyclable: 0, Residual: 0 };
    const typePoints: Record<WasteType, number> = { Biodegradable: 0, Recyclable: 0, Residual: 0 };
    const disposalsInRange = new Map<string, number>();
    const activeWeek = new Set<string>();
    let todayCount = 0, yesterdayCount = 0, todayPoints = 0, yesterdayPoints = 0, inRange = 0;

    for (const l of logs) {
      const d = toDate(l.timestamp);
      if (!d) continue;
      const pts = creditedOf(l);
      if (isToday(d)) { todayCount++; todayPoints += pts; }
      else if (isYesterday(d)) { yesterdayCount++; yesterdayPoints += pts; }
      if (d >= weekStart) activeWeek.add(l.userId);
      const day = days.get(format(d, 'yyyy-MM-dd'));
      if (day) { day.disposals++; day.points += pts; day.users.add(l.userId); }
      if (d >= cutoff) {
        inRange++;
        hourly[d.getHours()]++;
        if (l.wasteType in typeCount) { typeCount[l.wasteType]++; typePoints[l.wasteType] += pts; }
        disposalsInRange.set(l.userId, (disposalsInRange.get(l.userId) ?? 0) + 1);
      }
    }

    const pct = (n: number, of: number) => (of > 0 ? (n / of) * 100 : 0);
    const change = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : undefined);

    const totalPoints = customers.reduce((sum, u) => sum + lifetimeOf(u), 0);
    const avgPointsPerUser = customers.length > 0 ? totalPoints / customers.length : 0;
    const bio = typeCount.Biodegradable, rec = typeCount.Recyclable, res = typeCount.Residual;
    const pendingRedemptions = redemptions.filter(r => r.status === 'pending').length;
    const co2Saved = inRange * 0.5;

    return {
      totalDisposals: inRange,
      todayDisposals: todayCount,
      totalCustomers: customers.length,
      activeUsers: activeWeek.size,
      activeRate: pct(activeWeek.size, customers.length),
      totalPoints,
      avgPointsPerUser,
      pointsChange: change(todayPoints, yesterdayPoints),
      disposalChange: change(todayCount, yesterdayCount),
      bio, rec, res,
      hourlyData: hourly.map((count, hour) => ({ hour: `${hour}:00`, count })),
      dailyTrend: dayKeys.map(k => {
        const d = days.get(k)!;
        return { date: format(new Date(`${k}T00:00:00`), 'MMM dd'), disposals: d.disposals, points: d.points, users: d.users.size };
      }),
      userStats: [...customers]
        .sort((a, b) => lifetimeOf(b) - lifetimeOf(a))
        .slice(0, 5)
        .map(u => ({ ...u, disposals: disposalsInRange.get(u.uid) ?? 0 })),
      wastePerformance: (['Biodegradable', 'Recyclable', 'Residual'] as WasteType[]).map(type => ({
        type, count: typeCount[type], points: typePoints[type], color: WASTE_COLORS[type], percentage: pct(typeCount[type], inRange),
      })),
      pendingRedemptions,
      claimedRedemptions: redemptions.length - pendingRedemptions,
      redemptionRate: pct(redemptions.length, inRange),
      co2Saved,
      treesEquivalent: Math.floor(co2Saved / 21),
    };
  }, [logs, customers, redemptions, timeRange]);

  if (error) return <LoadError what="the dashboard" />;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-green" />
            <Recycle className="w-6 h-6 text-green absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-white/60 text-sm">Loading dashboard analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header Section */}
      <div className="bg-gradient-to-br from-card via-card to-card/50 border border-border rounded-2xl p-6 hover:border-green/30 transition-all duration-500 group relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-green/5 via-transparent to-blue/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green via-green to-dark-green flex items-center justify-center shadow-2xl shadow-green/30 group-hover:scale-110 group-hover:rotate-12 transition-all duration-500">
                <Recycle className="w-7 h-7 text-black" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">ECOReward Dashboard</h1>
                <p className="text-white/50 text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-green animate-pulse" />
                  Real-time Business Intelligence & Analytics
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 bg-green/10 border border-green/30 rounded-full backdrop-blur-sm">
                <span className="text-green text-sm font-bold flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green" />
                  </span>
                  Live
                </span>
              </div>
              <div className="text-white/40 text-sm font-medium">{format(new Date(), 'MMM dd, yyyy • HH:mm')}</div>
            </div>
          </div>

          {/* Quick Stats Bar */}
          {/* Change badges compare today with yesterday and only appear when there is a yesterday to compare with. */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <QuickStat label="Scans today" value={analytics.todayDisposals} change={analytics.disposalChange} />
            <QuickStat label="Active this week" value={`${analytics.activeUsers} (${analytics.activeRate.toFixed(0)}%)`} />
            <QuickStat label="Avg lifetime pts/user" value={Math.round(analytics.avgPointsPerUser)} />
            <QuickStat label="Points credited today" value={analytics.dailyTrend[13]?.points ?? 0} change={analytics.pointsChange} />
          </div>
        </div>
      </div>

      {/* Main KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={Recycle}
          label="Total Disposals"
          value={analytics.totalDisposals}
          subtitle={`${analytics.todayDisposals} today`}
          color="#00E676"
          trend={analytics.disposalChange}
        />
        <KPICard
          icon={Users}
          label="Total Customers"
          value={analytics.totalCustomers}
          subtitle={`${analytics.activeUsers} active this week`}
          color="#00B0FF"
        />
        <KPICard
          icon={Star}
          label="Lifetime Points Earned"
          value={analytics.totalPoints}
          subtitle={`Avg ${Math.round(analytics.avgPointsPerUser)}/customer`}
          color="#FFAB40"
        />
        <KPICard
          icon={Receipt}
          label="Redemptions"
          value={redemptions.length}
          subtitle={`${analytics.pendingRedemptions} pending`}
          color="#B388FF"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Trend Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 hover:border-green/20 transition-all duration-300 hover:shadow-2xl hover:shadow-green/5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green" />
                14-Day Performance Trend
              </h3>
              <p className="text-white/40 text-sm mt-1">Disposals, Points & Active Users</p>
            </div>
            <div className="flex gap-2">
              {TIME_RANGES.map(range => (
                <button
                  key={range}
                  aria-pressed={timeRange === range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    timeRange === range
                      ? 'bg-green text-black'
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={analytics.dailyTrend}>
              <defs>
                <linearGradient id="colorDisposals" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00E676" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#00E676" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorPoints" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FFAB40" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#FFAB40" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#30363D" />
              <XAxis dataKey="date" stroke="#ffffff40" style={{ fontSize: '11px' }} />
              <YAxis stroke="#ffffff40" style={{ fontSize: '11px' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: '12px', padding: '12px' }}
                labelStyle={{ color: '#fff', fontWeight: 'bold', marginBottom: '8px' }}
              />
              <Area type="monotone" dataKey="disposals" stroke="#00E676" strokeWidth={3} fill="url(#colorDisposals)" />
              <Area type="monotone" dataKey="points" stroke="#FFAB40" strokeWidth={2} fill="url(#colorPoints)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Waste Type Distribution */}
        <div className="bg-card border border-border rounded-2xl p-6 hover:border-blue/20 transition-all duration-300">
          <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue" />
            Waste Distribution
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={analytics.wastePerformance}
                dataKey="count"
                nameKey="type"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={5}
              >
                {analytics.wastePerformance.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-4">
            {analytics.wastePerformance.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-white/70 text-sm">{item.type}</span>
                </div>
                <span className="text-white font-semibold text-sm">{item.percentage.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Activity */}
        <div className="bg-card border border-border rounded-2xl p-6 hover:border-orange/20 transition-all duration-300">
          <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange" />
            24-Hour Activity Pattern
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={analytics.hourlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#30363D" />
              <XAxis dataKey="hour" stroke="#ffffff40" style={{ fontSize: '10px' }} interval={2} />
              <YAxis stroke="#ffffff40" style={{ fontSize: '11px' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: '12px' }}
              />
              <Bar dataKey="count" fill="#FFAB40" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Environmental Impact */}
        <div className="bg-gradient-to-br from-green/10 via-card to-card border border-green/30 rounded-2xl p-6 hover:border-green/50 transition-all duration-300">
          <h3 className="text-white font-bold text-lg mb-6 flex items-center gap-2">
            <Leaf className="w-5 h-5 text-green" />
            Environmental Impact
          </h3>
          <div className="space-y-6">
            <ImpactMetric
              icon={Leaf}
              label="CO₂ Saved"
              value={`${analytics.co2Saved.toFixed(1)} kg`}
              color="#00E676"
              description="Equivalent to planting trees"
            />
            <ImpactMetric
              icon={Award}
              label="Trees Equivalent"
              value={`${analytics.treesEquivalent} trees`}
              color="#8BC34A"
              description="Annual CO₂ absorption"
            />
            <ImpactMetric
              icon={Target}
              label="Waste Diverted"
              value={analytics.totalDisposals > 0 ? `${((analytics.bio + analytics.rec) / analytics.totalDisposals * 100).toFixed(1)}%` : '0.0%'}
              color="#00B0FF"
              description="From landfills"
            />
          </div>
        </div>
      </div>

      {/* Top Performers & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performers */}
        <div className="bg-card border border-border rounded-2xl p-6 hover:border-purple/20 transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold text-lg flex items-center gap-2">
              <Award className="w-5 h-5 text-purple" />
              Top Performers
            </h3>
            <Link href="/leaderboard" className="text-xs text-white/40 hover:text-yellow-400 transition-colors flex items-center gap-1">
              <Trophy className="w-3 h-3" />Full Leaderboard
            </Link>
          </div>
          <div className="space-y-3">
            {analytics.userStats.map((user, idx) => (
              <div key={user.uid} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all group cursor-pointer">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-purple to-purple/50 text-white font-bold text-sm">
                  #{idx + 1}
                </div>
                <div className="flex-1">
                  <div className="text-white font-semibold text-sm">{user.username}</div>
                  <div className="text-white/40 text-xs flex items-center gap-2">
                    {user.disposals} disposals
                    {(user.streak ?? 0) > 0 && <span className="text-orange-400">🔥 {user.streak}d</span>}
                    {(user.badges?.length ?? 0) > 0 && <span className="text-yellow-400">🏅 {user.badges!.length}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-orange font-bold">{lifetimeOf(user).toLocaleString()}</div>
                  <div className="text-white/40 text-xs">lifetime pts</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Operations — real numbers only (the old "System Health" bars were hard-coded, audit H-09) */}
        <div className="bg-card border border-border rounded-2xl p-6 hover:border-blue/20 transition-all duration-300">
          <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue" />
            Operations
          </h3>
          <div className="space-y-4">
            <HealthMetric label="Customers active this week" status={`${analytics.activeUsers} of ${analytics.totalCustomers}`} color="#00B0FF" percentage={analytics.activeRate} />
            <HealthMetric label="Redemptions waiting to be handed out" status={`${analytics.pendingRedemptions} pending`} color="#FFAB40"
              percentage={redemptions.length > 0 ? (analytics.pendingRedemptions / redemptions.length) * 100 : 0} />
            <HealthMetric label="Redemptions handed out" status={`${analytics.claimedRedemptions} claimed`} color="#00E676"
              percentage={redemptions.length > 0 ? (analytics.claimedRedemptions / redemptions.length) * 100 : 0} />
            <p className="text-white/30 text-xs">Data connection: live (Firestore listeners). Kiosk status: see Bin Management.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Components
function QuickStat({ label, value, change }: { label: string; value: number | string; change?: number }) {
  const isPositive = (change ?? 0) >= 0;
  return (
    <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
      <div>
        <div className="text-white/50 text-xs mb-1">{label}</div>
        <div className="text-white font-bold text-lg">{value}</div>
      </div>
      {change !== undefined && (
        <div className={`flex items-center gap-1 text-xs font-semibold ${isPositive ? 'text-green' : 'text-red'}`} title="vs yesterday">
          {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(change).toFixed(1)}%
        </div>
      )}
    </div>
  );
}

interface KPICardProps { icon: ElementType; label: string; value: number | string; subtitle: string; color: string; trend?: number }
function KPICard({ icon: Icon, label, value, subtitle, color, trend }: KPICardProps) {
  const isPositive = (trend ?? 0) >= 0;
  return (
    <div className="bg-card border border-border rounded-2xl p-5 hover:scale-105 hover:shadow-2xl transition-all duration-300 group cursor-pointer relative overflow-hidden">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: `linear-gradient(135deg, ${color}10, transparent)` }} />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300" style={{ backgroundColor: `${color}20` }}>
            <Icon className="w-6 h-6" style={{ color }} />
          </div>
          {trend !== undefined && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${isPositive ? 'bg-green/20 text-green' : 'bg-red/20 text-red'}`} title="today vs yesterday">
              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(trend).toFixed(1)}%
            </div>
          )}
        </div>
        <div className="text-3xl font-bold text-white mb-1">{typeof value === 'number' ? value.toLocaleString() : value}</div>
        <div className="text-white/40 text-xs">{label}</div>
        <div className="text-white/60 text-xs mt-2">{subtitle}</div>
      </div>
    </div>
  );
}

function ImpactMetric({ icon: Icon, label, value, color, description }: { icon: ElementType; label: string; value: string; color: string; description: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}20` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div className="flex-1">
        <div className="text-white/60 text-sm mb-1">{label}</div>
        <div className="text-2xl font-bold mb-1" style={{ color }}>{value}</div>
        <div className="text-white/40 text-xs">{description}</div>
      </div>
    </div>
  );
}

function HealthMetric({ label, status, color, percentage }: { label: string; status: string; color: string; percentage: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-white/70 text-sm">{label}</span>
        <span className="text-white font-semibold text-sm">{status}</span>
      </div>
      <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
        <div
          className="h-2 rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
