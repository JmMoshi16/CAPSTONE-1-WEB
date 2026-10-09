import type { ElementType } from 'react';

interface StatPillProps {
  label: string;
  value: number | string;
  color: string;
  icon?: ElementType;
}

/** Small labelled number tile; with an icon it renders as a compact horizontal pill. */
export default function StatPill({ label, value, color, icon: Icon }: StatPillProps) {
  const shown = typeof value === 'number' ? value.toLocaleString() : value;
  if (Icon) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
        <Icon className="w-4 h-4" style={{ color }} aria-hidden />
        <div>
          <div className="text-white font-bold text-sm">{shown}</div>
          <div className="text-white/40 text-xs">{label}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-card border rounded-card p-3 text-center" style={{ borderColor: `${color}33`, backgroundColor: `${color}0D` }}>
      <div className="text-xl font-bold text-white">{shown}</div>
      <div className="text-white/40 text-xs mt-0.5">{label}</div>
    </div>
  );
}
