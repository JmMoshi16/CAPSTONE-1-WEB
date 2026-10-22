'use client';

export const dynamic = 'force-dynamic';

import { Settings as SettingsIcon, Lock } from 'lucide-react';
import { RULES } from '@/lib/rules';

// Read-only on purpose: the kiosk (app.py) and the phone app take these values from config/rules.json,
// not from Firestore, so an editable form here would change nothing for real scans.
export default function SettingsPage() {
  const multipliers = RULES.streakMultipliers.map(m =>
    ({ label: m.maxDays === null ? `${m.minDays}+ day streak` : `${m.minDays}–${m.maxDays} day streak`, value: `×${m.multiplier}` }));

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-card border border-border rounded-card p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/5 border border-border flex items-center justify-center shrink-0">
            <SettingsIcon className="w-6 h-6 text-white/60" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Settings</h1>
            <p className="text-white/40 text-sm">The rules the kiosk and the phone app use right now</p>
          </div>
        </div>
      </div>

      <Section title="Points per Waste Type" subtitle="Base eco-points for one confirmed deposit">
        <Row label="Biodegradable" description="Organic / food waste" color="#8BC34A" value={RULES.points.Biodegradable} unit="pts" />
        <Row label="Recyclable" description="Plastic, paper, metal" color="#00B0FF" value={RULES.points.Recyclable} unit="pts" />
        <Row label="Residual" description="Non-recyclable waste" color="#EF5350" value={RULES.points.Residual} unit="pts" />
      </Section>

      <Section title="Streak Bonus" subtitle="The phone app multiplies the base points by the customer's daily streak">
        {multipliers.map(m => <Row key={m.label} label={m.label} color="#E2AE68" value={m.value} />)}
      </Section>

      <Section title="Kiosk" subtitle="QR receipts and bin alerts">
        <Row label="QR Code Expiry" description="Minutes a receipt's QR / claim code stays valid" color="#B388FF" value={RULES.qrExpiryMinutes} unit="min" />
        <Row label="Bin Warning" description="The kiosk shows a warning; the Bins page turns amber" color="#E2AE68" value={RULES.bin_warn_pct} unit="%" />
        <Row label="Bin Full" description="The kiosk pauses until the bin is emptied" color="#EF5350" value={RULES.bin_full_pct} unit="%" />
      </Section>

      <div className="flex gap-3 p-4 bg-card border border-border rounded-card text-sm text-white/50">
        <Lock className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          To change a value, edit <code className="text-green/70 bg-green/10 px-1.5 py-0.5 rounded text-xs">config/rules.json</code> in
          the kiosk repo and copy it to the web and Flutter repos (the kiosk&apos;s ConfigParityTest checks they match), then restart the kiosk.
        </p>
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-card p-6">
      <h2 className="text-white font-bold mb-1">{title}</h2>
      <p className="text-white/40 text-sm mb-5">{subtitle}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Row({ label, description, color, value, unit }: { label: string; description?: string; color: string; value: number | string; unit?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-bg border border-border rounded-xl">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <div className="min-w-0">
          <div className="text-white font-semibold text-sm">{label}</div>
          {description && <div className="text-white/40 text-xs">{description}</div>}
        </div>
      </div>
      <div className="shrink-0 text-white font-bold tabular-nums">
        {value}{unit && <span className="text-white/40 text-xs font-normal ml-1">{unit}</span>}
      </div>
    </div>
  );
}
