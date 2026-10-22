/** Rank tier for a customer's LIFETIME points (same thresholds as the phone app). */
export { rankFor as getRankBadge } from './rules';

const AVATAR_COLORS = [
  ['#00E676', '#00C853'],
  ['#00B0FF', '#0081CB'],
  ['#FF6D00', '#E65100'],
  ['#D500F9', '#9C00D4'],
];

/** Gradient pair for an avatar; an empty or missing name gets the first pair (audit M-06). */
export const getAvatarColor = (username: string | undefined): string[] =>
  AVATAR_COLORS[(username?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
