// The counter's reward codes: checking a code a customer shows, and spotting new redemptions. No runtime
// imports, so `node --test` runs it.
import type { Redemption } from './types';

/** Same rule the phone app shows customers: a reward code is valid for 7 days after redeeming. */
export const REDEMPTION_VALID_DAYS = 7;
/** The app's codes are 8 letters and digits (FirebaseService._generateCode). */
export const CODE_LENGTH = 8;

/** A code as staff might type it ("ab12 cd34", "AB12-CD34") in the stored form ("AB12CD34"). */
export const normalizeCode = (input: string): string => input.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Pending and past its 7 days. Unknown dates never expire. A claimed code is claimed, not expired. */
export function isExpired(r: Pick<Redemption, 'status' | 'redeemedAt'>, now: Date = new Date()): boolean {
  const t = new Date(r.redeemedAt).getTime();
  return r.status === 'pending' && !Number.isNaN(t) && now.getTime() > t + REDEMPTION_VALID_DAYS * 86_400_000;
}

export type CodeCheck =
  | { kind: 'empty' } | { kind: 'partial' } | { kind: 'notFound' }
  | { kind: 'valid'; redemption: Redemption } | { kind: 'claimed'; redemption: Redemption }
  | { kind: 'expired'; redemption: Redemption };

/** What the counter should do with the code the customer shows. */
export function checkCode(input: string, redemptions: Redemption[], now: Date = new Date()): CodeCheck {
  const code = normalizeCode(input);
  if (!code) return { kind: 'empty' };
  if (code.length < CODE_LENGTH) return { kind: 'partial' };
  const redemption = redemptions.find(r => normalizeCode(r.redemptionCode ?? '') === code);
  if (!redemption) return { kind: 'notFound' };
  if (redemption.status === 'claimed') return { kind: 'claimed', redemption };
  return { kind: isExpired(redemption, now) ? 'expired' : 'valid', redemption };
}

/** Why a code must not be handed out, read fresh from the database just before the hand-out; null when it may. */
export function claimRefusal(r: Pick<Redemption, 'status' | 'redeemedAt'> | undefined, now: Date = new Date()): string | null {
  if (!r) return 'This redemption no longer exists.';
  if (r.status !== 'pending') return 'This code was already handed out. Do not give the reward again.';
  if (isExpired(r, now)) return 'This code has expired (older than 7 days) and cannot be handed out.';
  return null;
}

/**
 * Pending redemptions not seen before, for the "new redemption" alert. The first load only fills `seen`, so opening
 * the console does not announce every code that is already waiting.
 */
export function freshPending(seen: Set<string>, redemptions: Redemption[], firstLoad: boolean): Redemption[] {
  const fresh: Redemption[] = [];
  for (const r of redemptions) {
    if (!r.id || seen.has(r.id)) continue;
    seen.add(r.id);
    if (!firstLoad && r.status === 'pending') fresh.push(r);
  }
  return fresh;
}
