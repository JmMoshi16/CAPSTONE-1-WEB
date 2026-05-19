'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo } from 'react';
import { Users as UsersIcon, Search, Star, Recycle, TrendingUp, ChevronRight, Download, Filter, Calendar, Award, Activity, Clock, Target, Zap, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { subscribeToCustomers, subscribeToWasteLogs, exportToCSV } from '@/lib/firebaseService';
import { UserModel, WasteLog, SortOption } from '@/lib/types';
import { getRankBadge, getAvatarColor } from '@/lib/utils';
import { format, isToday, isYesterday, subDays, startOfWeek } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

export default function UsersPage() {
  const [customers, setCustomers] = useState<UserModel[]>([]);
  const [logs, setLogs] = useState<WasteLog[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('points');
  const [filterRank, setFilterRank] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<UserModel | null>(null);
  const [ready, setReady] = useState({ customers: false, logs: false });

  useEffect(() => {
    const unsubCustomers = subscribeToCustomers(data => { setCustomers(data); setReady(r => ({ ...r, customers: true })); });
    const unsubLogs = subscribeToWasteLogs(data => { setLogs(data); setReady(r => ({ ...r, logs: true })); });
    return () => { unsubCustomers(); unsubLogs(); };
  }, []);

  const loading = !ready.customers || !ready.logs;

  const analytics = useMemo(() => {
    const totalPoints = customers.reduce((sum, u) => sum + u.points, 0);
    const avgPoints = customers.length > 0 ? totalPoints / customers.length : 0;
    
    const activeToday = new Set(logs.filter(l => isToday(new Date(l.timestamp))).map(l => l.userId)).size;
    const activeYesterday = new Set(logs.filter(l => isYesterday(new Date(l.timestamp))).map(l => l.userId)).size;
    const activeWeek = new Set(logs.filter(l => new Date(l.timestamp) >= startOfWeek(new Date())).map(l => l.userId)).size;
    
    const userGrowth = activeYesterday > 0 ? ((activeToday - activeYesterday) / activeYesterday) * 100 : 0;
    
    const rankDistribution = {
      platinum: customers.filter(u => u.points >= 500).length,
      gold: customers.filter(u => u.points >= 200 && u.points < 500).length,
      silver: customers.filter(u => u.points >= 50 && u.points < 200).length,
      bronze: customers.filter(u => u.points < 50).length,
    };

    const topPerformers = customers
      .map(u => ({
        ...u,
        disposals: logs.filter(l => l.userId === u.uid).length,
        weeklyDisposals: logs.filter(l => l.userId === u.uid && new Date(l.timestamp) >= startOfWeek(new Date())).length
      }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 3);

    return {
      totalPoints,
      avgPoints,
      activeToday,
      activeWeek,
      userGrowth,
      rankDistribution,
      topPerformers,
      engagementRate: customers.length > 0 ? (activeWeek / customers.length) * 100 : 0
    };
  }, [customers, logs]);

  const getUserLogs = (uid: string) => logs.filter(l => l.userId === uid);

  const filteredUsers = useMemo(() => {
    return customers
      .filter(u => {
        const matchesSearch = u.username.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
        if (!matchesSearch) return false;
        
        if (filterRank === 'all') return true;
        const rank = getRankBadge(u.points).label.toLowerCase();
        return rank === filterRank;
      })
      .sort((a, b) => {
        if (sortBy === 'points') return b.points - a.points;
        if (sortBy === 'disposals') return getUserLogs(b.uid).length - getUserLogs(a.uid).length;
        return a.username.localeCompare(b.username);
      });
  }, [customers, search, sortBy, filterRank, logs]);

  const handleExport = () => {
    exportToCSV(
      customers.map(u => ({
        Username: u.username,
        Email: u.email,
        Points: u.points,
        Disposals: getUserLogs(u.uid).length,
        'Date Joined': new Date(u.createdAt).toLocaleDateString(),
        Rank: getRankBadge(u.points).label,
      })),
      'ecoreward-users.csv'
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue" />
            <UsersIcon className="w-6 h-6 text-blue absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-white/60 text-sm">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-card via-card to-card/50 border border-border rounded-2xl p-6 hover:border-blue/30 transition-all duration-500 group">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue to-blue/50 flex items-center justify-center shadow-2xl shadow-blue/30 group-hover:scale-110 transition-all duration-500">
              <UsersIcon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">Customer Management</h1>
              <p className="text-white/50 text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue animate-pulse" />
                {customers.length} registered users • {analytics.activeToday} active today
              </p>
            </div>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue/10 border border-blue/30 rounded-xl text-blue font-bold hover:bg-blue/20 transition-all hover:scale-105"
          >
            <Download className="w-4 h-4" />
            Export Data
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4">
          <QuickMetric
            icon={UsersIcon}
            label="Total Users"
            value={customers.length}
            change={analytics.userGrowth}
            color="#00B0FF"
          />
          <QuickMetric
            icon={Zap}
            label="Active Today"
            value={analytics.activeToday}
            subtitle={`${analytics.activeWeek} this week`}
            color="#00E676"
          />
          <QuickMetric
            icon={Star}
            label="Avg Points"
            value={Math.round(analytics.avgPoints)}
            subtitle={`${analytics.totalPoints.toLocaleString()} total`}
            color="#FFAB40"
          />
          <QuickMetric
            icon={Target}
            label="Engagement"
            value={`${analytics.engagementRate.toFixed(1)}%`}
            subtitle="Weekly active rate"
            color="#B388FF"
          />
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rank Distribution */}
        <div className="bg-card border border-border rounded-2xl p-6 hover:border-purple/20 transition-all duration-300">
          <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-purple" />
            Rank Distribution
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Platinum', value: analytics.rankDistribution.platinum, color: '#00B0FF' },
                  { name: 'Gold', value: analytics.rankDistribution.gold, color: '#FFAB40' },
                  { name: 'Silver', value: analytics.rankDistribution.silver, color: '#9E9E9E' },
                  { name: 'Bronze', value: analytics.rankDistribution.bronze, color: '#CD7F32' },
                ]}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
              >
                {[
                  { color: '#00B0FF' },
                  { color: '#FFAB40' },
                  { color: '#9E9E9E' },
                  { color: '#CD7F32' },
                ].map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <RankBadge label="Platinum" count={analytics.rankDistribution.platinum} color="#00B0FF" />
            <RankBadge label="Gold" count={analytics.rankDistribution.gold} color="#FFAB40" />
            <RankBadge label="Silver" count={analytics.rankDistribution.silver} color="#9E9E9E" />
            <RankBadge label="Bronze" count={analytics.rankDistribution.bronze} color="#CD7F32" />
          </div>
        </div>

        {/* Top Performers */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 hover:border-green/20 transition-all duration-300">
          <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-green" />
            Top Performers
          </h3>
          <div className="space-y-3">
            {analytics.topPerformers.map((user, idx) => {
              const colors = getAvatarColor(user.username);
              const medals = ['🥇', '🥈', '🥉'];
              return (
                <div key={user.uid} className="flex items-center gap-4 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-all group cursor-pointer">
                  <span className="text-2xl w-8 text-center">{medals[idx]}</span>
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0 group-hover:scale-110 transition-transform"
                    style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }}
                  >
                    {user.username[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-bold text-sm">{user.username}</div>
                    <div className="text-white/40 text-xs">{user.disposals} total disposals • {user.weeklyDisposals} this week</div>
                  </div>
                  <div className="text-right">
                    <div className="text-orange font-bold text-lg">{user.points}</div>
                    <div className="text-white/40 text-xs">points</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full bg-bg border border-border rounded-xl pl-12 pr-4 py-3 text-white text-sm focus:outline-none focus:border-blue transition-all"
            />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-white/40" />
              <span className="text-white/40 text-sm font-medium">Rank:</span>
            </div>
            {['all', 'platinum', 'gold', 'silver', 'bronze'].map(rank => (
              <button
                key={rank}
                onClick={() => setFilterRank(rank)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${
                  filterRank === rank
                    ? 'bg-blue text-white'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                {rank}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white/40 text-sm font-medium">Sort:</span>
            {(['points', 'disposals', 'name'] as SortOption[]).map(opt => (
              <button
                key={opt}
                onClick={() => setSortBy(opt)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${
                  sortBy === opt
                    ? 'bg-green text-black'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* User List */}
      {filteredUsers.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <UsersIcon className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <p className="text-white/40">{search ? 'No users match your search' : 'No customers yet'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((user, index) => (
            <UserCard
              key={user.uid}
              user={user}
              rank={sortBy !== 'name' ? index : -1}
              disposals={getUserLogs(user.uid).length}
              onClick={() => setSelectedUser(user)}
            />
          ))}
        </div>
      )}

      {selectedUser && (
        <UserDrawer
          user={selectedUser}
          logs={getUserLogs(selectedUser.uid)}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}

function QuickMetric({ icon: Icon, label, value, change, subtitle, color }: any) {
  const hasChange = change !== undefined;
  const isPositive = change >= 0;
  
  return (
    <div className="p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-all group cursor-pointer border border-transparent hover:border-white/10">
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform" style={{ backgroundColor: `${color}20` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        {hasChange && (
          <div className={`flex items-center gap-1 text-xs font-semibold ${isPositive ? 'text-green' : 'text-red'}`}>
            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(change).toFixed(1)}%
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      <div className="text-white/40 text-xs">{label}</div>
      {subtitle && <div className="text-white/30 text-xs mt-1">{subtitle}</div>}
    </div>
  );
}

function RankBadge({ label, count, color }: any) {
  return (
    <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
      <span className="text-white/70 text-xs">{label}</span>
      <span className="font-bold text-sm" style={{ color }}>{count}</span>
    </div>
  );
}

function UserCard({ user, rank, disposals, onClick }: any) {
  const medals = ['🥇', '🥈', '🥉'];
  const rankBadge = getRankBadge(user.points);
  const colors = getAvatarColor(user.username);

  return (
    <div
      onClick={onClick}
      className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4 cursor-pointer hover:border-blue/30 hover:shadow-xl hover:shadow-blue/5 transition-all duration-300 group"
    >
      <div className="w-10 text-center shrink-0">
        {rank >= 0 && rank < 3 ? (
          <span className="text-2xl">{medals[rank]}</span>
        ) : rank >= 3 ? (
          <span className="text-white/30 text-sm font-bold">#{rank + 1}</span>
        ) : null}
      </div>
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl shrink-0 group-hover:scale-110 transition-transform shadow-lg"
        style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }}
      >
        {user.username[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-white font-bold text-base">{user.username}</span>
          <span
            className="px-2 py-0.5 rounded-full text-xs font-bold border"
            style={{ backgroundColor: `${rankBadge.color}26`, borderColor: `${rankBadge.color}66`, color: rankBadge.color }}
          >
            {rankBadge.label}
          </span>
        </div>
        <div className="text-white/40 text-sm truncate">{user.email}</div>
        <div className="text-white/30 text-xs mt-1">Joined {format(new Date(user.createdAt), 'MMM dd, yyyy')}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="flex items-center gap-1.5 text-orange text-base font-bold mb-1">
          <Star className="w-4 h-4" />
          {user.points.toLocaleString()}
        </div>
        <div className="flex items-center gap-1.5 text-white/40 text-sm">
          <Recycle className="w-4 h-4" />
          {disposals} disposals
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-white/30 shrink-0 group-hover:text-blue group-hover:translate-x-1 transition-all" />
    </div>
  );
}

function UserDrawer({ user, logs, onClose }: any) {
  const rankBadge = getRankBadge(user.points);
  const colors = getAvatarColor(user.username);
  const totalEarned = logs.reduce((sum: number, l: WasteLog) => sum + l.pointsEarned, 0);
  const bio = logs.filter((l: WasteLog) => l.wasteType === 'Biodegradable').length;
  const rec = logs.filter((l: WasteLog) => l.wasteType === 'Recyclable').length;
  const res = logs.filter((l: WasteLog) => l.wasteType === 'Residual').length;

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dayLogs = logs.filter((l: WasteLog) => format(new Date(l.timestamp), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'));
    return {
      day: format(date, 'EEE'),
      count: dayLogs.length
    };
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-end animate-fadeIn" onClick={onClose}>
      <div
        className="w-full max-w-lg h-full bg-card border-l border-border overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border p-6 z-10">
          <div className="flex items-center gap-4 mb-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shrink-0 shadow-xl"
              style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }}
            >
              {user.username[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-white font-bold text-xl truncate">{user.username}</h2>
              <p className="text-white/60 text-sm truncate">{user.email}</p>
              <span
                className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold border"
                style={{ backgroundColor: `${rankBadge.color}26`, borderColor: `${rankBadge.color}66`, color: rankBadge.color }}
              >
                {rankBadge.label} Member
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <MiniStat icon={Star} label="Points" value={user.points} color="#FFAB40" />
            <MiniStat icon={Recycle} label="Disposals" value={logs.length} color="#00E676" />
            <MiniStat icon={TrendingUp} label="Earned" value={totalEarned} color="#FF6D00" />
          </div>

          {/* Activity Chart */}
          <div className="bg-bg border border-border rounded-xl p-4">
            <h3 className="text-white/70 font-semibold text-sm mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              7-Day Activity
            </h3>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={last7Days}>
                <defs>
                  <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00B0FF" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#00B0FF" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363D" />
                <XAxis dataKey="day" stroke="#ffffff40" style={{ fontSize: '10px' }} />
                <YAxis stroke="#ffffff40" style={{ fontSize: '10px' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: '8px' }}
                />
                <Area type="monotone" dataKey="count" stroke="#00B0FF" strokeWidth={2} fill="url(#colorActivity)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Waste Breakdown */}
          <div className="bg-bg border border-border rounded-xl p-4">
            <h3 className="text-white/70 font-semibold text-sm mb-4">Waste Breakdown</h3>
            <WasteBar label="Biodegradable" count={bio} total={logs.length} color="#8BC34A" />
            <WasteBar label="Recyclable" count={rec} total={logs.length} color="#00B0FF" />
            <WasteBar label="Residual" count={res} total={logs.length} color="#EF5350" />
          </div>

          {/* Recent Activity */}
          {logs.length > 0 && (
            <div>
              <h3 className="text-white/70 font-semibold text-sm mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Recent Activity
              </h3>
              <div className="space-y-2">
                {logs.slice(0, 10).map((log: WasteLog, i: number) => <LogItem key={i} log={log} />)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, color }: any) {
  return (
    <div className="rounded-xl p-3 text-center border hover:scale-105 transition-transform" style={{ backgroundColor: `${color}14`, borderColor: `${color}33` }}>
      <Icon className="w-5 h-5 mx-auto mb-2" style={{ color }} />
      <div className="text-white font-bold text-lg">{value.toLocaleString()}</div>
      <div className="text-white/40 text-xs">{label}</div>
    </div>
  );
}

function WasteBar({ label, count, total, color }: any) {
  const pct = total === 0 ? 0 : (count / total) * 100;
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between text-xs mb-2">
        <span className="text-white/60">{label}</span>
        <span className="font-bold" style={{ color }}>{count} ({pct.toFixed(1)}%)</span>
      </div>
      <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
        <div 
          className="h-2 rounded-full transition-all duration-700 ease-out" 
          style={{ width: `${pct}%`, backgroundColor: color }} 
        />
      </div>
    </div>
  );
}

function LogItem({ log }: { log: WasteLog }) {
  const colorMap: Record<string, string> = { Biodegradable: '#8BC34A', Recyclable: '#00B0FF', Residual: '#EF5350' };
  const color = colorMap[log.wasteType] ?? '#ffffff';
  return (
    <div className="bg-bg border border-border rounded-xl p-3 flex items-center justify-between hover:bg-white/5 transition-all">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
          <Recycle className="w-4 h-4" style={{ color }} />
        </div>
        <div>
          <div className="text-white/70 text-sm font-medium">{log.wasteType}</div>
          <div className="text-white/40 text-xs">{format(new Date(log.timestamp), 'MMM dd, HH:mm')}</div>
        </div>
      </div>
      <span className="text-sm font-bold" style={{ color }}>+{log.pointsEarned} pts</span>
    </div>
  );
}
