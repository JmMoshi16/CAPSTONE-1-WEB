/** Rank tier for a customer's LIFETIME points (same thresholds as the phone app). */
export const getRankBadge = (points: number): { label: string; color: string } => {
  if (points >= 500) return { label: 'Platinum', color: '#00B0FF' };
  if (points >= 200) return { label: 'Gold', color: '#FFAB40' };
  if (points >= 50) return { label: 'Silver', color: '#9E9E9E' };
  return { label: 'Bronze', color: '#CD7F32' };
};

const AVATAR_COLORS = [
  ['#00E676', '#00C853'],
  ['#00B0FF', '#0081CB'],
  ['#FF6D00', '#E65100'],
  ['#D500F9', '#9C00D4'],
];

/** Gradient pair for an avatar; an empty or missing name gets the first pair (audit M-06). */
export const getAvatarColor = (username: string | undefined): string[] =>
  AVATAR_COLORS[(username?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
