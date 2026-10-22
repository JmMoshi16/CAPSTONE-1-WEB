'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, type ElementType } from 'react';
import { Trophy, Star, Recycle, Flame, Crown, Users } from 'lucide-react';
import { subscribeToLeaderboard, LEADERBOARD_SIZE } from '@/lib/firebaseService';
import { UserModel, lifetimeOf } from '@/lib/types';
import { getAvatarColor } from '@/lib/utils';
import { useLoadTimeout } from '@/lib/useLoadTimeout';
import StatPill from '@/components/StatPill';
import LoadError from '@/components/LoadError';
import PageLoader from '@/components/PageLoader';

import { BADGES as BADGE_DEFS, rankFor as getRankTier } from '@/lib/rules';

export default function LeaderboardPage() {
  const [users, setUsers] = useState<UserModel[]>([]);
  const [loading, setLoading] = useState(true);
  const error = useLoadTimeout(loading);
  const [selected, setSelected] = useState<UserModel | null>(null);

  useEffect(() => {
    const unsub = subscribeToLeaderboard(data => {
      setUsers(data);
      setLoading(false);
    });
    return () => { unsub(); };
  }, []);

  // Podium only with 3+ customers; the list then starts at #4 instead of repeating the podium.
  // With 1-2 customers there is no podium and the list shows everyone (audit M-07).
  const showPodium = users.length >= 3;
  const top3 = users.slice(0, 3);
  const listed = showPodium ? users.slice(3) : users;
  const listOffset = showPodium ? 3 : 0;

  const totalPoints = users.reduce((s, u) => s + lifetimeOf(u), 0);
  const totalScans  = users.reduce((s, u) => s + (u.scanCount ?? 0), 0);
  const topStreak   = users.reduce((m, u) => Math.max(m, u.streak ?? 0), 0);

  if (error) return <LoadError what="the leaderboard" />;

  if (loading) {
    return <PageLoader what="the leaderboard" />;
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-card via-card to-card/50 border border-border rounded-2xl p-6 hover:border-yellow-400/30 transition-all duration-500 group relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/5 via-transparent to-orange-400/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-forest/60 ring-1 ring-green/25 flex items-center justify-center shrink-0">
              <Trophy className="w-7 h-7 text-green" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">Leaderboard</h1>
              <p className="text-white/50 text-sm">Top {users.length} of up to {LEADERBOARD_SIZE} customers, ranked by lifetime points</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <StatPill icon={Star} label="Lifetime Points" value={totalPoints.toLocaleString()} color="#E2AE68" />
            <StatPill icon={Recycle} label="Total Scans" value={totalScans.toLocaleString()} color="#7CCFA5" />
            <StatPill icon={Flame} label="Top Streak" value={`${topStreak}d`} color="#FF6D00" />
          </div>
        </div>
      </div>

      {/* Podium */}
      {showPodium && (
        <div className="bg-gradient-to-b from-yellow-400/10 via-card to-card border border-yellow-400/20 rounded-2xl p-8">
          <div className="flex items-end justify-center gap-4 mb-2">
            {/* 2nd */}
            <PodiumCard user={top3[1]} rank={2} height="h-28" medal="🥈" color="#9E9E9E" onClick={() => setSelected(top3[1])} />
            {/* 1st */}
            <PodiumCard user={top3[0]} rank={1} height="h-40" medal="🥇" color="#E2AE68" crown onClick={() => setSelected(top3[0])} />
            {/* 3rd */}
            <PodiumCard user={top3[2]} rank={3} height="h-20" medal="🥉" color="#CD7F32" onClick={() => setSelected(top3[2])} />
          </div>
        </div>
      )}

      {/* Rest of list */}
      {listed.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-border flex items-center gap-2">
            <Users className="w-5 h-5 text-white/40" />
            <span className="text-white font-bold">{showPodium ? 'Other Rankings' : 'All Rankings'}</span>
            <span className="text-white/40 text-sm ml-1">({listed.length} users)</span>
          </div>
          <div className="divide-y divide-border">
            {listed.map((user, i) => (
              <LeaderRow key={user.uid} user={user} rank={i + 1 + listOffset} onClick={() => setSelected(user)} />
            ))}
          </div>
        </div>
      )}

      {/* User detail drawer */}
      {selected && <UserDetailDrawer user={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

interface PodiumCardProps {
  user: UserModel; rank: number; height: string; medal: string; color: string; crown?: boolean; onClick: () => void;
}
function PodiumCard({ user, rank, height, medal, color, crown = false, onClick }: PodiumCardProps) {
  const colors = getAvatarColor(user.username);
  return (
    <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={onClick}>
      {crown && <Crown className="w-6 h-6 text-yellow-400 animate-bounce" />}
      <span className="text-3xl">{medal}</span>
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-xl group-hover:scale-110 transition-transform"
        style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }}
      >
        {user.username[0]?.toUpperCase()}
      </div>
      <div className="text-center">
        <div className="text-white font-bold text-sm max-w-[90px] truncate">{user.username}</div>
        <div className="font-bold text-sm" style={{ color }}>{lifetimeOf(user).toLocaleString()} pts</div>
        {(user.badges?.length ?? 0) > 0 && (
          <div className="text-white/40 text-xs">{user.badges!.length} badges</div>
        )}
      </div>
      <div className={`w-24 ${height} rounded-t-xl flex items-center justify-center border border-white/10`}
        style={{ backgroundColor: `${color}20` }}>
        <span className="text-white/60 font-bold text-lg">#{rank}</span>
      </div>
    </div>
  );
}

function LeaderRow({ user, rank, onClick }: { user: UserModel; rank: number; onClick: () => void }) {
  const colors = getAvatarColor(user.username);
  const tier = getRankTier(lifetimeOf(user));
  const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-all cursor-pointer group"
    >
      <div className="w-10 text-center shrink-0">
        {rank <= 3
          ? <span className="text-xl">{medals[rank]}</span>
          : <span className="text-white/30 font-bold text-sm">#{rank}</span>
        }
      </div>
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0 group-hover:scale-110 transition-transform"
        style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }}
      >
        {user.username[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white font-semibold text-sm">{user.username}</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold border"
            style={{ backgroundColor: `${tier.color}26`, borderColor: `${tier.color}66`, color: tier.color }}>
            {tier.icon} {tier.label}
          </span>
          {(user.badges?.length ?? 0) > 0 && (
            <span className="text-white/30 text-xs">{user.badges!.length} badges</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-white/40 text-xs flex items-center gap-1">
            <Recycle className="w-3 h-3" />{user.scanCount ?? 0} scans
          </span>
          {(user.streak ?? 0) > 0 && (
            <span className="text-orange-400 text-xs flex items-center gap-1">
              <Flame className="w-3 h-3" />🔥 {user.streak}d streak
            </span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-yellow-400 font-bold text-base">{lifetimeOf(user).toLocaleString()}</div>
        <div className="text-white/40 text-xs">lifetime pts</div>
      </div>
    </div>
  );
}

function UserDetailDrawer({ user, onClose }: { user: UserModel; onClose: () => void }) {
  const colors = getAvatarColor(user.username);
  const tier = getRankTier(lifetimeOf(user));
  const earnedBadges = BADGE_DEFS.filter(b => user.badges?.includes(b.id));
  const lockedBadges = BADGE_DEFS.filter(b => !user.badges?.includes(b.id));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-end" onClick={onClose}>
      <div
        className="w-full max-w-md h-full bg-card border-l border-border overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border p-6 z-10">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-xl"
              style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }}
            >
              {user.username[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-white font-bold text-xl truncate">{user.username}</h2>
              <p className="text-white/50 text-sm truncate">{user.email}</p>
              <span className="inline-block mt-1 px-3 py-1 rounded-full text-xs font-bold border"
                style={{ backgroundColor: `${tier.color}26`, borderColor: `${tier.color}66`, color: tier.color }}>
                {tier.icon} {tier.label} Member
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniStat icon={Star} label="Lifetime" value={lifetimeOf(user)} color="#E2AE68" />
            <MiniStat icon={Star} label="Balance" value={user.points ?? 0} color="#FFD54F" />
            <MiniStat icon={Recycle} label="Scans" value={user.scanCount ?? 0} color="#7CCFA5" />
            <MiniStat icon={Flame} label="Streak" value={`${user.streak ?? 0}d`} color="#FF6D00" />
          </div>

          {/* Badges earned */}
          {earnedBadges.length > 0 && (
            <div className="bg-bg border border-border rounded-xl p-4">
              <h3 className="text-white/70 font-semibold text-sm mb-3 flex items-center gap-2">
                <span>🏅</span> Badges Earned ({earnedBadges.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {earnedBadges.map(b => (
                  <span key={b.id} className="flex items-center gap-1 px-3 py-1.5 bg-yellow-400/10 border border-yellow-400/30 rounded-full text-xs font-semibold text-yellow-300">
                    {b.icon} {b.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Locked badges */}
          {lockedBadges.length > 0 && (
            <div className="bg-bg border border-border rounded-xl p-4">
              <h3 className="text-white/40 font-semibold text-sm mb-3 flex items-center gap-2">
                🔒 Locked ({lockedBadges.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {lockedBadges.map(b => (
                  <span key={b.id} className="flex items-center gap-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs text-white/30">
                    {b.icon} {b.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, color }: { icon: ElementType; label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-xl p-3 text-center border hover:scale-105 transition-transform"
      style={{ backgroundColor: `${color}14`, borderColor: `${color}33` }}>
      <Icon className="w-5 h-5 mx-auto mb-2" style={{ color }} />
      <div className="text-white font-bold text-lg">{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div className="text-white/40 text-xs">{label}</div>
    </div>
  );
}
