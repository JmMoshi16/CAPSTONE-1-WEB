/** Rank tier for a customer's LIFETIME points (same thresholds as the phone app). */
export { rankFor as getRankBadge } from './rules';

// Deep brand tones (forest, coffee, harbour, plum): the cream initial reads on every one of them.
const AVATAR_COLORS = [
  ['#3E7A4C', '#1F3F27'],
  ['#8A6340', '#4A3122'],
  ['#2C6E99', '#173F5C'],
  ['#7A4F8E', '#432A52'],
];

/** Gradient pair for an avatar; an empty or missing name gets the first pair (audit M-06). */
export const getAvatarColor = (username: string | undefined): string[] =>
  AVATAR_COLORS[(username?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
