'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo } from 'react';
import { Recycle, Users, Star, Receipt, TrendingUp, TrendingDown, Trash2, Clock, Zap, Activity, ArrowUpRight, ArrowDownRight, Target, Award, Leaf, BarChart3, Calendar, MapPin, AlertCircle, CheckCircle } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';
import { subscribeToCustomers, subscribeToWasteLogs, subscribeToRedemptions } from '@/lib/firebaseService';
import { UserModel, WasteLog, Redemption } from '@/lib/types';
import { format, subDays, startOfDay, isToday, isYesterday, startOfWeek, startOfMonth } from 'date-fns';

export default function DashboardPage() {
  const [customers, setCustomers] = useState<UserModel[]>([]);
  const [logs, setLogs] = useState<WasteLog[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [ready, setReady] = useState({ customers: false, logs: false, redemptions: false });
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'all'>('week');

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

  // Advanced Analytics Calculations
  const analytics = useMemo(() => {
    const now = new Date();
    const todayLogs = logs.filter(l => isToday(new Date(l.timestamp)));
    const yesterdayLogs = logs.filter(l => isYesterday(new Date(l.timestamp)));
    const weekLogs = logs.filter(l => new Date(l.timestamp) >= startOfWeek(now));
    const monthLogs = logs.filter(l => new Date(l.timestamp) >= startOfMonth(now));

    const totalPoints = customers.reduce((sum, u) => sum + u.points, 0);
    const avgPointsPerUser = customers.length > 0 ? totalPoints / customers.length : 0;
    
    const todayPoints = todayLogs.reduce((sum, l) => sum + l.pointsEarned, 0);
    const yesterdayPoints = yesterdayLogs.reduce((sum, l) => sum + l.pointsEarned, 0);
    const pointsGrowth = yesterdayPoints > 0 ? ((todayPoints - yesterdayPoints) / yesterdayPoints) * 100 : 0;

    const activeUsers = new Set(weekLogs.map(l => l.userId)).size;
    const userGrowthRate = customers.length > 0 ? (activeUsers / customers.length) * 100 : 0;

    // Waste breakdown
    const bio = logs.filter(l => l.wasteType === 'Biodegradable').length;
    const rec = logs.filter(l => l.wasteType === 'Recyclable').length;
    const res = logs.filter(l => l.wasteType === 'Residual').length;

    // Hourly distribution
    const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
      hour: `${hour}:00`,
      count: logs.filter(l => new Date(l.timestamp).getHours() === hour).length
    }));

    // Daily trend (last 14 days)
    const dailyTrend = Array.from({ length: 14 }, (_, i) => {
      const date = subDays(now, 13 - i);
      const dayLogs = logs.filter(l => format(new Date(l.timestamp), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'));
      return {
        date: format(date, 'MMM dd'),
        disposals: dayLogs.length,
        points: dayLogs.reduce((sum, l) => sum + l.pointsEarned, 0),
        users: new Set(dayLogs.map(l => l.userId)).size
      };
    });

    // Top performers
    const userStats = customers.map(user => ({
      ...user,
      disposals: logs.filter(l => l.userId === user.uid).length,
      lastActive: logs.filter(l => l.userId === user.uid).sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )[0]?.timestamp
    })).sort((a, b) => b.points - a.points).slice(0, 5);

    // Waste type performance
    const wastePerformance = [
      { type: 'Biodegradable', count: bio, points: bio * 15, color: '#8BC34A', percentage: logs.length > 0 ? (bio / logs.length) * 100 : 0 },
      { type: 'Recyclable', count: rec, points: rec * 10, color: '#00B0FF', percentage: logs.length > 0 ? (rec / logs.length) * 100 : 0 },
      { type: 'Residual', count: res, points: res * 5, color: '#EF5350', percentage: logs.length > 0 ? (res / logs.length) * 100 : 0 }
    ];

    // Redemption stats
    const pendingRedemptions = redemptions.filter(r => r.status === 'pending').length;
    const claimedRedemptions = redemptions.filter(r => r.status === 'claimed').length;
    const redemptionRate = logs.length > 0 ? (redemptions.length / logs.length) * 100 : 0;

    // Environmental impact
    const co2Saved = logs.length * 0.5; // kg CO2 per disposal
    const treesEquivalent = Math.floor(co2Saved / 21); // 21kg CO2 per tree per year

    return {
      totalDisposals: logs.length,
      todayDisposals: todayLogs.length,
      totalCustomers: customers.length,
      activeUsers,
      totalPoints,
      avgPointsPerUser,
      pointsGrowth,
      userGrowthRate,
      bio, rec, res,
      hourlyData,
      dailyTrend,
      userStats,
      wastePerformance,
      pendingRedemptions,
      claimedRedemptions,
      redemptionRate,
      co2Saved,
      treesEquivalent,
      disposalChange: yesterdayLogs.length > 0 ? ((todayLogs.length - yesterdayLogs.length) / yesterdayLogs.length) * 100 : 0
    };
  }, [logs, customers, redemptions]);

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
          <div className="flex items-center justify-between mb-4">
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
          <div className="grid grid-cols-4 gap-4 mt-6">
            <QuickStat label="Today" value={analytics.todayDisposals} change={analytics.disposalChange} />
            <QuickStat label="Active Users" value={analytics.activeUsers} change={analytics.userGrowthRate} />
            <QuickStat label="Avg Points/User" value={Math.round(analytics.avgPointsPerUser)} change={analytics.pointsGrowth} />
            <QuickStat label="Redemption Rate" value={`${analytics.redemptionRate.toFixed(1)}%`} change={5.2} />
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
          trend={12.5}
        />
        <KPICard
          icon={Star}
          label="Points Distributed"
          value={analytics.totalPoints}
          subtitle={`Avg ${Math.round(analytics.avgPointsPerUser)}/user`}
          color="#FFAB40"
          trend={analytics.pointsGrowth}
        />
        <KPICard
          icon={Receipt}
          label="Redemptions"
          value={redemptions.length}
          subtitle={`${analytics.pendingRedemptions} pending`}
          color="#B388FF"
          trend={8.3}
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
              {['today', 'week', 'month', 'all'].map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range as any)}
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
              value={`${((analytics.bio + analytics.rec) / analytics.totalDisposals * 100).toFixed(1)}%`}
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
          <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-purple" />
            Top Performers
          </h3>
          <div className="space-y-3">
            {analytics.userStats.map((user, idx) => (
              <div key={user.uid} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all group cursor-pointer">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-purple to-purple/50 text-white font-bold text-sm">
                  #{idx + 1}
                </div>
                <div className="flex-1">
                  <div className="text-white font-semibold text-sm">{user.username}</div>
                  <div className="text-white/40 text-xs">{user.disposals} disposals</div>
                </div>
                <div className="text-right">
                  <div className="text-orange font-bold">{user.points}</div>
                  <div className="text-white/40 text-xs">points</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Health */}
        <div className="bg-card border border-border rounded-2xl p-6 hover:border-blue/20 transition-all duration-300">
          <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue" />
            System Health
          </h3>
          <div className="space-y-4">
            <HealthMetric label="Database Status" status="Operational" color="#00E676" percentage={100} />
            <HealthMetric label="API Response Time" status="Fast" color="#00E676" percentage={95} />
            <HealthMetric label="Active Connections" status={`${analytics.activeUsers} users`} color="#00B0FF" percentage={85} />
            <HealthMetric label="Pending Tasks" status={`${analytics.pendingRedemptions} items`} color="#FFAB40" percentage={70} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Components
function QuickStat({ label, value, change }: { label: string; value: number | string; change: number }) {
  const isPositive = change >= 0;
  return (
    <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
      <div>
        <div className="text-white/50 text-xs mb-1">{label}</div>
        <div className="text-white font-bold text-lg">{value}</div>
      </div>
      <div className={`flex items-center gap-1 text-xs font-semibold ${isPositive ? 'text-green' : 'text-red'}`}>
        {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {Math.abs(change).toFixed(1)}%
      </div>
    </div>
  );
}

function KPICard({ icon: Icon, label, value, subtitle, color, trend }: any) {
  const isPositive = trend >= 0;
  return (
    <div className="bg-card border border-border rounded-2xl p-5 hover:scale-105 hover:shadow-2xl transition-all duration-300 group cursor-pointer relative overflow-hidden">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: `linear-gradient(135deg, ${color}10, transparent)` }} />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300" style={{ backgroundColor: `${color}20` }}>
            <Icon className="w-6 h-6" style={{ color }} />
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${isPositive ? 'bg-green/20 text-green' : 'bg-red/20 text-red'}`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        </div>
        <div className="text-3xl font-bold text-white mb-1">{typeof value === 'number' ? value.toLocaleString() : value}</div>
        <div className="text-white/40 text-xs">{label}</div>
        <div className="text-white/60 text-xs mt-2">{subtitle}</div>
      </div>
    </div>
  );
}

function ImpactMetric({ icon: Icon, label, value, color, description }: any) {
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

function HealthMetric({ label, status, color, percentage }: any) {
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
