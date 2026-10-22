// The business rules the kiosk (app.py) and the phone app actually use, from config/rules.json.
// Copy that file from the kiosk repo when it changes; never re-type its values here (audit M-24).
import _rules from '../config/rules.json';

export const RULES = _rules;

export type Badge = (typeof _rules.badges)[number];
export const BADGES: Badge[] = _rules.badges;

const RANK_COLORS: Record<string, string> = { Platinum: '#00B0FF', Gold: '#FFAB40', Silver: '#9E9E9E', Bronze: '#CD7F32' };

/** Rank tier for a customer's LIFETIME points, from rules.json `ranks` (same tiers as the phone app). */
export function rankFor(points: number): { label: string; color: string; icon: string } {
  const r = [..._rules.ranks].reverse().find(t => points >= t.minPts) ?? _rules.ranks[0];
  return { label: r.label, color: RANK_COLORS[r.label] ?? '#9E9E9E', icon: r.icon };
}
