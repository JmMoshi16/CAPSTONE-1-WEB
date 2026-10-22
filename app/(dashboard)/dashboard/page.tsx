'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo, type ElementType } from 'react';
import Link from 'next/link';
import { Recycle, Users, Star, Receipt, TrendingUp, Clock, Activity, ArrowUpRight, ArrowDownRight, Target, Award, Leaf, BarChart3, Trophy } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { subscribeToRecentWasteLogs, subscribeToWasteLogs, subscribeToLeaderboard, getAdminStats, type AdminStats } from '@/lib/firebaseService';
import { UserModel, WasteLog, WasteType, lifetimeOf, creditedOf } from '@/lib/types';
import { toDate } from '@/lib/dates';
import { format, subDays, startOfDay, isToday, isYesterday, startOfWeek, startOfMonth } from 'date-fns';
import { useLoadTimeout } from '@/lib/useLoadTimeout';
import LoadError from '@/components/LoadError';
import PageLoader from '@/components/PageLoader';
import CountUp from '@/components/CountUp';

type TimeRange = 'today' | 'week' | 'month' | 'all';
const TIME_RANGES: TimeRange[] = ['today', 'week', 'month', 'all'];
const WASTE_COLORS: Record<WasteType, string> = { Biodegradable: '#8BC34A', Recyclable: '#00B0FF', Residual: '#EF5350' };

export default function DashboardPage() {
  // Phase 9: totals come from server-side aggregations, the top five from the 50-row leaderboard
  // listener, and only the last 31 days of logs are downloaded (all logs only when 'All' is picked).
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [top, setTop] = useState<UserModel[] | null>(null);
  const [recentLogs, setRecentLogs] = useState<WasteLog[] | null>(null);
  const [allLogs, setAllLogs] = useState<WasteLog[] | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('week');

  useEffect(() => {
    getAdminStats().then(setStats).catch(e => console.error('[dashboard stats]', e));
    const unsubTop = subscribeToLeaderboard(setTop);
    const unsubLogs = subscribeToRecentWasteLogs(setRecentLogs);
    return () => { unsubTop(); unsubLogs(); };
  }, []);

  useEffect(() => {
    if (timeRange !== 'all') return;
    return subscribeToWasteLogs(setAllLogs);
  }, [timeRange]);

  const logs = useMemo(() => (timeRange === 'all' ? allLogs : recentLogs) ?? [], [timeRange, allLogs, recentLogs]);
  const customers = useMemo(() => top ?? [], [top]);
  const loading = !stats || !top || !recentLogs || (timeRange === 'all' && !allLogs);
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

    const customerCount = stats?.customers ?? 0;
    const totalPoints = stats?.lifetimePoints ?? 0;
    const avgPointsPerUser = customerCount > 0 ? totalPoints / customerCount : 0;
    const bio = typeCount.Biodegradable, rec = typeCount.Recyclable, res = typeCount.Residual;
    const pendingRedemptions = stats?.pendingRedemptions ?? 0;
    const redemptionTotal = stats?.redemptions ?? 0;

    return {
      totalDisposals: inRange,
      todayDisposals: todayCount,
      totalCustomers: customerCount,
      activeUsers: activeWeek.size,
      activeRate: pct(activeWeek.size, customerCount),
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
      userStats: customers.slice(0, 5)
        .map(u => ({ ...u, disposals: disposalsInRange.get(u.uid) ?? 0 })),
      wastePerformance: (['Biodegradable', 'Recyclable', 'Residual'] as WasteType[]).map(type => ({
        type, count: typeCount[type], points: typePoints[type], color: WASTE_COLORS[type], percentage: pct(typeCount[type], inRange),
      })),
      pendingRedemptions,
      redemptionTotal,
      claimedRedemptions: redemptionTotal - pendingRedemptions,
      redemptionRate: pct(redemptionTotal, inRange),
    };
  }, [logs, customers, stats, timeRange]);

  if (error) return <LoadError what="the dashboard" />;

  if (loading) {
    return <PageLoader what="the dashboard" />;
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header: what day it is, what this is, and that it is live. */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">{format(new Date(), 'EEEE, MMMM d')}</div>
          <h1 className="text-4xl lg:text-[44px] text-white mt-2">ECOReward Dashboard</h1>
          <p className="text-white/50 text-sm mt-2 flex items-center gap-2">
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full rounded-full bg-green animate-breathe" />
            </span>
            Live: numbers update as scans arrive
          </p>
        </div>
        <Link href="/bins" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] ring-1 ring-border text-sm text-white/70 hover:text-white hover:ring-green/30 transition">
          Check the bins <ArrowUpRight className="w-4 h-4" aria-hidden />
        </Link>
      </header>

      {/* Today at a glance. Change badges compare with yesterday and only appear when there is a yesterday. */}
      <section aria-label="Today" className="bg-card border border-border rounded-2xl grid grid-cols-3 divide-x divide-border">
        <QuickStat label="Scans today" value={analytics.todayDisposals} change={analytics.disposalChange} />
        <QuickStat label="Points credited today" value={analytics.dailyTrend[13]?.points ?? 0} change={analytics.pointsChange} />
        <QuickStat label="Rewards to hand out" value={analytics.pendingRedemptions}
          note={analytics.pendingRedemptions > 0 ? 'Waiting at the counter' : 'All handed out'} href="/rewards" />
      </section>

      {/* Main KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KPICard
          icon={Recycle}
          label="Total Disposals"
          value={analytics.totalDisposals}
          subtitle={`${analytics.todayDisposals} today`}
          color="#7CCFA5"
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
          color="#E2AE68"
        />
        <KPICard
          icon={Receipt}
          label="Redemptions"
          value={analytics.redemptionTotal}
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
                  <stop offset="5%" stopColor="#7CCFA5" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#7CCFA5" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorPoints" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#E2AE68" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#E2AE68" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A342D" />
              <XAxis dataKey="date" stroke="#F2EDE340" style={{ fontSize: '11px' }} />
              <YAxis stroke="#F2EDE340" style={{ fontSize: '11px' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#161D18', border: '1px solid #2A342D', borderRadius: '12px', padding: '12px' }}
                labelStyle={{ color: '#F2EDE3', fontWeight: 'bold', marginBottom: '8px' }}
              />
              <Area type="monotone" dataKey="disposals" stroke="#7CCFA5" strokeWidth={3} fill="url(#colorDisposals)" />
              <Area type="monotone" dataKey="points" stroke="#E2AE68" strokeWidth={2} fill="url(#colorPoints)" />
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
                paddingAngle={analytics.wastePerformance.filter(w => w.count > 0).length > 1 ? 5 : 0}
              >
                {analytics.wastePerformance.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#161D18', border: '1px solid #2A342D', borderRadius: '12px' }}
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
              <CartesianGrid strokeDasharray="3 3" stroke="#2A342D" />
              <XAxis dataKey="hour" stroke="#F2EDE340" style={{ fontSize: '10px' }} interval={2} />
              <YAxis stroke="#F2EDE340" style={{ fontSize: '11px' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#161D18', border: '1px solid #2A342D', borderRadius: '12px' }}
              />
              <Bar dataKey="count" fill="#E2AE68" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Sorting quality, counted from scans. No CO2 figure: items are not weighed per scan yet, and the old
            0.5 kg/item factor had no source (same decision as the phone app). */}
        <div className="bg-card border border-border rounded-2xl p-6 card-lift">
          <h3 className="text-white font-bold text-lg mb-1 flex items-center gap-2">
            <Leaf className="w-5 h-5 text-green" />
            Kept out of residual
          </h3>
          <p className="text-white/40 text-sm mb-6">Items sorted as recyclable or biodegradable, in the selected period</p>
          <div className="flex items-end gap-3 mb-6">
            <div className="numeral text-6xl text-green">
              <CountUp value={analytics.totalDisposals > 0 ? (analytics.bio + analytics.rec) / analytics.totalDisposals * 100 : 0}
                format={n => `${n.toFixed(0)}%`} />
            </div>
            <div className="text-white/50 text-sm pb-2">
              {(analytics.bio + analytics.rec).toLocaleString()} of {analytics.totalDisposals.toLocaleString()} items
            </div>
          </div>
          <div className="space-y-4">
            <ImpactMetric icon={Leaf} label="Biodegradable" value={analytics.bio.toLocaleString()} color="#8BC34A" description="Sorted for composting" />
            <ImpactMetric icon={Recycle} label="Recyclable" value={analytics.rec.toLocaleString()} color="#00B0FF" description="Sorted for recycling" />
            <ImpactMetric icon={Target} label="Residual" value={analytics.res.toLocaleString()} color="#EF5350" description="Went to general waste" />
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
            <HealthMetric label="Redemptions waiting to be handed out" status={`${analytics.pendingRedemptions} pending`} color="#E2AE68"
              percentage={analytics.redemptionTotal > 0 ? (analytics.pendingRedemptions / analytics.redemptionTotal) * 100 : 0} />
            <HealthMetric label="Redemptions handed out" status={`${analytics.claimedRedemptions} claimed`} color="#7CCFA5"
              percentage={analytics.redemptionTotal > 0 ? (analytics.claimedRedemptions / analytics.redemptionTotal) * 100 : 0} />
            <p className="text-white/30 text-xs">Data connection: live (Firestore listeners). Kiosk status: see Bin Management.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Components
function Trend({ change, title }: { change: number; title: string }) {
  const up = change >= 0;
  return (
    <span title={title}
      className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold ${up ? 'bg-green/10 text-green' : 'bg-res/10 text-res'}`}>
      {up ? <ArrowUpRight className="w-3 h-3" aria-hidden /> : <ArrowDownRight className="w-3 h-3" aria-hidden />}
      <span className="sr-only">{up ? 'up' : 'down'} </span>{Math.abs(change).toFixed(1)}%
    </span>
  );
}

function QuickStat({ label, value, change, note, href }: { label: string; value: number; change?: number; note?: string; href?: string }) {
  const body = (
    <>
      <div className="text-white/50 text-xs mb-2">{label}</div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="numeral text-3xl text-white"><CountUp value={value} /></span>
        {change !== undefined && <Trend change={change} title="vs yesterday" />}
      </div>
      {note && <div className="text-white/40 text-xs mt-1">{note}</div>}
    </>
  );
  return href
    ? <Link href={href} className="block p-4 sm:p-5 hover:bg-white/[0.03] transition-colors first:rounded-l-2xl last:rounded-r-2xl">{body}</Link>
    : <div className="p-4 sm:p-5">{body}</div>;
}

interface KPICardProps { icon: ElementType; label: string; value: number; subtitle: string; color: string; trend?: number }
function KPICard({ icon: Icon, label, value, subtitle, color, trend }: KPICardProps) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 card-lift relative overflow-hidden">
      {/* a faint wash of the card's colour from the corner */}
      <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-2xl opacity-[0.12]" style={{ backgroundColor: color }} aria-hidden />
      <div className="relative">
        <div className="flex items-center justify-between mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}1F` }}>
            <Icon className="w-5 h-5" style={{ color }} aria-hidden />
          </div>
          {trend !== undefined && <Trend change={trend} title="today vs yesterday" />}
        </div>
        <div className="numeral text-3xl sm:text-[40px] text-white"><CountUp value={value} /></div>
        <div className="text-white/70 text-sm font-medium mt-2">{label}</div>
        <div className="text-white/40 text-xs mt-1">{subtitle}</div>
      </div>
    </div>
  );
}

function ImpactMetric({ icon: Icon, label, value, color, description }: { icon: ElementType; label: string; value: string; color: string; description: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}1F` }}>
        <Icon className="w-4 h-4" style={{ color }} aria-hidden />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-white/80 text-sm">{label}</div>
        <div className="text-white/40 text-xs">{description}</div>
      </div>
      <div className="numeral text-xl" style={{ color }}>{value}</div>
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
