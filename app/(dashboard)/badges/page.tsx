'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo } from 'react';
import { Award, Users, Star, TrendingUp, Lock, CheckCircle } from 'lucide-react';
import { subscribeToCustomers } from '@/lib/firebaseService';
import { UserModel } from '@/lib/types';
import { getAvatarColor } from '@/lib/utils';
import { useLoadTimeout } from '@/lib/useLoadTimeout';

const BADGE_DEFS = [
  { id: 'first_scan', label: 'First Scan',   desc: 'Completed first scan',       icon: '🌱', req: 'scans',  value: 1,   color: '#8BC34A' },
  { id: 'scan_5',     label: '5 Scans',       desc: 'Scanned waste 5 times',      icon: '♻️', req: 'scans',  value: 5,   color: '#00B0FF' },
  { id: 'scan_10',    label: 'Eco Starter',   desc: 'Scanned waste 10 times',     icon: '🌿', req: 'scans',  value: 10,  color: '#4CAF50' },
  { id: 'scan_25',    label: 'Eco Warrior',   desc: 'Scanned waste 25 times',     icon: '🏆', req: 'scans',  value: 25,  color: '#FFAB40' },
  { id: 'scan_50',    label: 'Eco Champion',  desc: 'Scanned waste 50 times',     icon: '🥇', req: 'scans',  value: 50,  color: '#FF6D00' },
  { id: 'pts_50',     label: 'Point Earner',  desc: 'Earned 50 points total',     icon: '⭐', req: 'points', value: 50,  color: '#FFC107' },
  { id: 'pts_100',    label: 'Century Club',  desc: 'Earned 100 points total',    icon: '💯', req: 'points', value: 100, color: '#FF9800' },
  { id: 'pts_500',    label: 'Platinum Eco',  desc: 'Earned 500 points total',    icon: '💎', req: 'points', value: 500, color: '#00B0FF' },
  { id: 'streak_3',   label: 'On a Roll',     desc: '3-day scan streak',          icon: '🔥', req: 'streak', value: 3,   color: '#FF5722' },
  { id: 'streak_7',   label: 'Week Warrior',  desc: '7-day scan streak',          icon: '🌟', req: 'streak', value: 7,   color: '#9C27B0' },
];

export default function BadgesPage() {
  const [customers, setCustomers] = useState<UserModel[]>([]);
  const [loading, setLoading] = useState(true);
  const error = useLoadTimeout(loading);

  useEffect(() => {
    const unsub = subscribeToCustomers(data => {
      setCustomers(data);
      setLoading(false);
    });
    return () => { unsub(); };
  }, []);

  const stats = useMemo(() => {
    const totalBadgesAwarded = customers.reduce((s, u) => s + (u.badges?.length ?? 0), 0);
    const usersWithBadges = customers.filter(u => (u.badges?.length ?? 0) > 0).length;

    const badgeCounts = BADGE_DEFS.map(b => ({
      ...b,
      count: customers.filter(u => u.badges?.includes(b.id)).length,
      pct: customers.length > 0
        ? (customers.filter(u => u.badges?.includes(b.id)).length / customers.length) * 100
        : 0,
    }));

    const topEarners = [...customers]
      .sort((a, b) => (b.badges?.length ?? 0) - (a.badges?.length ?? 0))
      .slice(0, 5);

    return { totalBadgesAwarded, usersWithBadges, badgeCounts, topEarners };
  }, [customers]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <Award className="w-16 h-16 text-red-400" />
          <p className="text-white font-bold text-lg">Failed to load badges</p>
          <p className="text-white/40 text-sm">Check your Firebase connection and try again.</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2 bg-yellow-400/10 border border-yellow-400/30 rounded-xl text-yellow-400 font-bold hover:bg-yellow-400/20 transition">Retry</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-yellow-400" />
            <Award className="w-6 h-6 text-yellow-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-white/60 text-sm">Loading badges...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-card via-card to-card/50 border border-border rounded-2xl p-6 hover:border-yellow-400/30 transition-all duration-500 group relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/5 via-transparent to-purple-400/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center shadow-2xl shadow-yellow-400/30 group-hover:scale-110 group-hover:rotate-12 transition-all duration-500">
              <Award className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">Badge Management</h1>
              <p className="text-white/50 text-sm">{BADGE_DEFS.length} badge types • {stats.totalBadgesAwarded} awarded total</p>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            <StatPill icon={Award} label="Total Awarded" value={stats.totalBadgesAwarded} color="#FFAB40" />
            <StatPill icon={Users} label="Users with Badges" value={stats.usersWithBadges} color="#00E676" />
          </div>
        </div>
      </div>

      {/* Badge grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {stats.badgeCounts.map(b => (
          <BadgeCard key={b.id} badge={b} total={customers.length} />
        ))}
      </div>

      {/* Top badge earners + rarest badges */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top earners */}
        <div className="bg-card border border-border rounded-2xl p-6 hover:border-yellow-400/20 transition-all">
          <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-400" />
            Top Badge Earners
          </h3>
          <div className="space-y-3">
            {stats.topEarners.map((user, i) => {
              const colors = getAvatarColor(user.username);
              return (
                <div key={user.uid} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
                  <span className="text-white/40 font-bold text-sm w-6">#{i + 1}</span>
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shrink-0"
                    style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }}
                  >
                    {user.username[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold text-sm truncate">{user.username}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(user.badges ?? []).slice(0, 4).map(id => {
                        const def = BADGE_DEFS.find(b => b.id === id);
                        return def ? (
                          <span key={id} className="text-xs">{def.icon}</span>
                        ) : null;
                      })}
                      {(user.badges?.length ?? 0) > 4 && (
                        <span className="text-white/30 text-xs">+{user.badges!.length - 4}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-yellow-400 font-bold">{user.badges?.length ?? 0}</div>
                    <div className="text-white/40 text-xs">badges</div>
                  </div>
                </div>
              );
            })}
            {stats.topEarners.length === 0 && (
              <p className="text-white/30 text-sm text-center py-4">No badges earned yet</p>
            )}
          </div>
        </div>

        {/* Rarest badges */}
        <div className="bg-card border border-border rounded-2xl p-6 hover:border-purple-400/20 transition-all">
          <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            Badge Unlock Rate
          </h3>
          <div className="space-y-3">
            {[...stats.badgeCounts].sort((a, b) => a.pct - b.pct).map(b => (
              <div key={b.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/70 flex items-center gap-1.5">
                    <span>{b.icon}</span>{b.label}
                  </span>
                  <span className="font-bold" style={{ color: b.color }}>
                    {b.count}/{customers.length} ({b.pct.toFixed(0)}%)
                  </span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-1.5 rounded-full transition-all duration-700"
                    style={{ width: `${b.pct}%`, backgroundColor: b.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BadgeCard({ badge, total }: { badge: typeof BADGE_DEFS[0] & { count: number; pct: number }; total: number }) {
  const unlocked = badge.count > 0;
  return (
    <div
      className="bg-card border rounded-2xl p-5 flex flex-col items-center text-center hover:scale-105 transition-all duration-300 group"
      style={{ borderColor: unlocked ? `${badge.color}40` : '#30363D' }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-3 group-hover:scale-110 transition-transform"
        style={{ backgroundColor: `${badge.color}20` }}
      >
        {badge.icon}
      </div>
      <div className="text-white font-bold text-sm mb-1">{badge.label}</div>
      <div className="text-white/40 text-xs mb-3">{badge.desc}</div>
      <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden mb-2">
        <div
          className="h-1.5 rounded-full transition-all duration-700"
          style={{ width: `${badge.pct}%`, backgroundColor: badge.color }}
        />
      </div>
      <div className="flex items-center gap-1 text-xs font-bold" style={{ color: badge.color }}>
        {unlocked
          ? <><CheckCircle className="w-3 h-3" />{badge.count} earned</>
          : <><Lock className="w-3 h-3 text-white/30" /><span className="text-white/30">0 earned</span></>
        }
      </div>
      <div className="text-white/30 text-xs mt-0.5">
        Req: {badge.req === 'scans' ? `${badge.value} scans` : badge.req === 'points' ? `${badge.value} pts` : `${badge.value}d streak`}
      </div>
    </div>
  );
}

function StatPill({ icon: Icon, label, value, color }: any) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
      <Icon className="w-4 h-4" style={{ color }} />
      <div>
        <div className="text-white font-bold text-sm">{value}</div>
        <div className="text-white/40 text-xs">{label}</div>
      </div>
    </div>
  );
}
