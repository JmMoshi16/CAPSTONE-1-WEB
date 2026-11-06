// Manual Claim rules: the same credit the phone app gives for a scan (lib/core/gamification.dart and
// computeNewBadges in the Flutter repo), driven by config/rules.json. No imports, so `node --test` runs it.

export interface StreakTier { minDays: number; maxDays: number | null; multiplier: number }
export interface BadgeRule { id: string; req: string; value: number; bonus?: number }
export interface CreditRules { streakMultipliers: StreakTier[]; badges: BadgeRule[] }

export interface CustomerStats {
  points?: number;
  lifetimePoints?: number;
  scanCount?: number;
  streak?: number;
  lastScanDate?: string;   // yyyy-MM-dd, local
  badges?: string[];
}

/** yyyy-MM-dd in local time, the format stored in `users.lastScanDate`. */
export function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysSince(last: string | undefined, today: Date): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(last ?? '');
  if (!m) return -1;
  const then = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((now.getTime() - then.getTime()) / 86_400_000);
}

/** Streak after a scan made on [today]. */
export function nextStreak(current: number, lastScanDate: string | undefined, today: Date): number {
  const diff = daysSince(lastScanDate, today);
  if (diff === 0) return current < 1 ? 1 : current;
  if (diff === 1) return current + 1;
  return 1;
}

/** Streak to SHOW: the stored one goes stale once a whole day is missed (the app's effectiveStreak). */
export function activeStreak(user: Pick<CustomerStats, 'streak' | 'lastScanDate'>, today: Date): number {
  const diff = daysSince(user.lastScanDate, today);
  return diff === 0 || diff === 1 ? user.streak ?? 0 : 0;
}

/** The most one write may add to a customer's points (the security rules' bound). */
export const MAX_CREDIT = 100;

export function multiplierFor(streak: number, tiers: StreakTier[]): number {
  const tier = tiers.find(t => streak >= t.minDays && (t.maxDays == null || streak <= t.maxDays));
  return tier?.multiplier ?? 1;
}

/**
 * Everything one scan changes on the customer's document, exactly as the app writes it (creditScanFor). Each badge
 * the scan unlocks pays its one-time bonus on top, spendable and lifetime; badges are checked once, on the scan's
 * own result, and the bonus is cut only where scan plus bonus would pass MAX_CREDIT.
 */
export function creditScan(user: CustomerStats, base: number, today: Date, rules: CreditRules) {
  const streak = nextStreak(user.streak ?? 0, user.lastScanDate, today);
  const multiplier = multiplierFor(streak, rules.streakMultipliers);
  const awarded = Math.round(base * multiplier);
  const before = user.points ?? 0;
  const points = before + awarded;
  const lifetimePoints = (typeof user.lifetimePoints === 'number' ? user.lifetimePoints : before) + awarded;
  const scanCount = (user.scanCount ?? 0) + 1;
  const owned = user.badges ?? [];
  const newBadges = rules.badges
    .filter(b => !owned.includes(b.id))
    .filter(b => (b.req === 'scans' && scanCount >= b.value)
      || (b.req === 'points' && lifetimePoints >= b.value)
      || (b.req === 'streak' && streak >= b.value))
    .map(b => b.id);
  const bonus = rules.badges.filter(b => newBadges.includes(b.id)).reduce((sum, b) => sum + (b.bonus ?? 0), 0);
  const badgeBonus = Math.min(bonus, Math.max(0, MAX_CREDIT - awarded));
  return {
    awarded, multiplier, streak, points: points + badgeBonus, lifetimePoints: lifetimePoints + badgeBonus, scanCount,
    lastScanDate: localDayKey(today), badges: [...owned, ...newBadges], newBadges, badgeBonus,
  };
}

/**
 * Claim codes are 4 digits, so two unused tokens can share one. Choose among ALL of them: the single
 * unexpired one, or refuse instead of guessing (an expired match must not hide a live one either).
 */
export function pickClaimToken(tokens: { id: string; expiresAt: Date | null }[], now: Date):
  { ok: true; id: string } | { ok: false; reason: 'not-found' | 'expired' | 'ambiguous' } {
  if (tokens.length === 0) return { ok: false, reason: 'not-found' };
  const live = tokens.filter(t => !t.expiresAt || t.expiresAt > now);
  if (live.length === 0) return { ok: false, reason: 'expired' };
  if (live.length > 1) return { ok: false, reason: 'ambiguous' };
  return { ok: true, id: live[0].id };
}
