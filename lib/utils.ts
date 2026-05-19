import { WasteLog } from './types';
import { format, subDays, startOfDay } from 'date-fns';

export const linearRegression = (yValues: number[]): number[] => {
  const n = yValues.length;
  if (n === 0) return Array(10).fill(0);
  
  const xMean = (n - 1) / 2;
  const yMean = yValues.reduce((a, b) => a + b, 0) / n;
  
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (yValues[i] - yMean);
    denominator += (i - xMean) * (i - xMean);
  }
  
  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yMean - slope * xMean;
  
  return Array.from({ length: n + 3 }, (_, i) => Math.max(0, slope * i + intercept));
};

export const getLast7DaysData = (logs: WasteLog[]): number[] => {
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i);
    return format(startOfDay(date), 'yyyy-MM-dd');
  });
  
  return days.map(day => {
    return logs.filter(log => {
      const logDate = format(new Date(log.timestamp), 'yyyy-MM-dd');
      return logDate === day;
    }).length;
  });
};

export const getPeakHour = (logs: WasteLog[]): string => {
  if (logs.length === 0) return 'N/A';
  
  const hourCount: Record<number, number> = {};
  logs.forEach(log => {
    const hour = new Date(log.timestamp).getHours();
    hourCount[hour] = (hourCount[hour] || 0) + 1;
  });
  
  const peakHour = Object.entries(hourCount).reduce((a, b) => 
    b[1] > a[1] ? b : a
  )[0];
  
  const peak = parseInt(peakHour);
  const end = (peak + 2) % 24;
  
  const formatHour = (h: number) => {
    if (h === 0) return '12 AM';
    if (h < 12) return `${h} AM`;
    if (h === 12) return '12 PM';
    return `${h - 12} PM`;
  };
  
  return `${formatHour(peak)} – ${formatHour(end)}`;
};

export const getMostCommonWaste = (logs: WasteLog[]): string => {
  if (logs.length === 0) return 'N/A';
  
  const count: Record<string, number> = {};
  logs.forEach(log => {
    count[log.wasteType] = (count[log.wasteType] || 0) + 1;
  });
  
  return Object.entries(count).reduce((a, b) => b[1] > a[1] ? b : a)[0];
};

export const getWasteBreakdown = (logs: WasteLog[]) => {
  const bio = logs.filter(l => l.wasteType === 'Biodegradable').length;
  const rec = logs.filter(l => l.wasteType === 'Recyclable').length;
  const res = logs.filter(l => l.wasteType === 'Residual').length;
  
  return { bio, rec, res, total: logs.length };
};

export const getRankBadge = (points: number): { label: string; color: string } => {
  if (points >= 500) return { label: 'Platinum', color: '#00B0FF' };
  if (points >= 200) return { label: 'Gold', color: '#FFAB40' };
  if (points >= 50) return { label: 'Silver', color: '#9E9E9E' };
  return { label: 'Bronze', color: '#CD7F32' };
};

export const getAvatarColor = (username: string): string[] => {
  const colors = [
    ['#00E676', '#00C853'],
    ['#00B0FF', '#0081CB'],
    ['#FF6D00', '#E65100'],
    ['#D500F9', '#9C00D4'],
  ];
  const index = username.charCodeAt(0) % colors.length;
  return colors[index];
};
