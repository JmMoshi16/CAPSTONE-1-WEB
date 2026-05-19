'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Save, RotateCcw } from 'lucide-react';
import { subscribeToSettings, saveSettings } from '@/lib/firebaseService';
import { AppSettings, DEFAULT_SETTINGS } from '@/lib/types';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [form, setForm] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = subscribeToSettings(data => {
      setSettings(data);
      setForm(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const isDirty = JSON.stringify(form) !== JSON.stringify(settings);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveSettings(form);
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => setForm(settings);

  const update = (key: keyof AppSettings, value: number) =>
    setForm(prev => ({ ...prev, [key]: value }));

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-card border border-border rounded-card p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/5 border border-border flex items-center justify-center">
            <SettingsIcon className="w-6 h-6 text-white/60" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Settings</h1>
            <p className="text-white/40 text-sm">System configuration — changes sync to all devices</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Points Configuration */}
        <div className="bg-card border border-border rounded-card p-6">
          <h2 className="text-white font-bold mb-1">Points per Waste Type</h2>
          <p className="text-white/40 text-sm mb-5">How many eco-points customers earn per disposal</p>
          <div className="space-y-4">
            <SettingRow
              label="Biodegradable"
              description="Organic / food waste"
              color="#8BC34A"
              value={form.pointsBiodegradable}
              onChange={v => update('pointsBiodegradable', v)}
            />
            <SettingRow
              label="Recyclable"
              description="Plastic, paper, metal"
              color="#00B0FF"
              value={form.pointsRecyclable}
              onChange={v => update('pointsRecyclable', v)}
            />
            <SettingRow
              label="Residual"
              description="Non-recyclable waste"
              color="#EF5350"
              value={form.pointsResidual}
              onChange={v => update('pointsResidual', v)}
            />
          </div>
        </div>

        {/* QR & Bin Settings */}
        <div className="bg-card border border-border rounded-card p-6">
          <h2 className="text-white font-bold mb-1">System Settings</h2>
          <p className="text-white/40 text-sm mb-5">QR token expiry and bin alert thresholds</p>
          <div className="space-y-4">
            <SettingRow
              label="QR Code Expiry"
              description="Minutes before a generated QR token expires"
              color="#B388FF"
              value={form.qrExpiryMinutes}
              onChange={v => update('qrExpiryMinutes', v)}
              unit="min"
              min={5}
              max={60}
            />
            <SettingRow
              label="Bin Fill Alert"
              description="Alert threshold for bin fill level"
              color="#FFAB40"
              value={form.maxBinFillAlert}
              onChange={v => update('maxBinFillAlert', v)}
              unit="%"
              min={50}
              max={100}
            />
          </div>
        </div>

        {/* Last updated */}
        {settings.updatedAt && (
          <p className="text-white/30 text-xs px-1">
            Last saved: {new Date(settings.updatedAt).toLocaleString()}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleReset}
            disabled={!isDirty}
            className="flex items-center gap-2 px-5 py-3 border border-border rounded-btn text-white/60 hover:text-white hover:border-white/30 transition disabled:opacity-30 text-sm font-medium"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button
            type="submit"
            disabled={saving || !isDirty}
            className="flex-1 flex items-center justify-center gap-2 bg-green hover:bg-dark-green text-black font-bold py-3 rounded-btn transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}

interface SettingRowProps {
  label: string;
  description: string;
  color: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  min?: number;
  max?: number;
}
function SettingRow({ label, description, color, value, onChange, unit = 'pts', min = 1, max = 999 }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-bg border border-border rounded-xl">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <div className="min-w-0">
          <div className="text-white font-semibold text-sm">{label}</div>
          <div className="text-white/40 text-xs">{description}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <input
          type="number"
          value={value}
          onChange={e => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || min)))}
          min={min}
          max={max}
          className="w-20 bg-card border border-border rounded-btn px-3 py-2 text-white text-sm text-center focus:outline-none focus:border-green transition"
        />
        <span className="text-white/40 text-xs w-6">{unit}</span>
      </div>
    </div>
  );
}
