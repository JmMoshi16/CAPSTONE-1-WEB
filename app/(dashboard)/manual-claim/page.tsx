'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { ClipboardCheck, Search, CheckCircle, XCircle, Loader2, User, Recycle, Star, Mail, ShieldCheck } from 'lucide-react';
import { lookupUsersByUsername, manualClaimPoints } from '@/lib/firebaseService';
import { BADGES } from '@/lib/rules';

type Step = 'form' | 'confirm' | 'success' | 'error';

interface FoundUser {
  uid: string;
  username: string;
  email: string;
  points: number;
}

interface ClaimResult {
  username: string;
  email: string;
  wasteType: string;
  pointsAwarded: number;
  newBadges: string[];
}

const WASTE_COLORS: Record<string, string> = {
  Biodegradable: '#8BC34A',
  Recyclable:    '#29B6F6',
  Residual:      '#EF5350',
};

export default function ManualClaimPage() {
  const [claimCode, setClaimCode]   = useState('');
  const [username, setUsername]     = useState('');
  const [step, setStep]             = useState<Step>('form');
  const [errorMsg, setErrorMsg]     = useState('');
  const [foundUser, setFoundUser]   = useState<FoundUser | null>(null);
  const [candidates, setCandidates] = useState<FoundUser[]>([]);   // several customers share the username
  const [result, setResult]         = useState<ClaimResult | null>(null);
  const [loading, setLoading]       = useState(false);

  // Step 1 — look up user by username
  const handleLookup = async () => {
    const code = claimCode.trim().toUpperCase().replace(/\s/g, '');
    const uname = username.trim();

    if (!code || !uname) {
      setErrorMsg('Both claim code and username are required.');
      setStep('error');
      return;
    }
    const digits = code.replace(/^ECO-/i, '');
    if (!/^\d{4}$/.test(digits)) {
      setErrorMsg('Invalid claim code. Expected format: ECO-XXXX (4 digits).');
      setStep('error');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const users = await lookupUsersByUsername(uname);
      if (users.length === 0) {
        setErrorMsg(`No account found with username "${uname}".`);
        setStep('error');
      } else {
        // Usernames are not unique: with several matches staff choose by email, never the first one silently.
        setCandidates(users);
        setFoundUser(users.length === 1 ? users[0] : null);
        setStep('confirm');
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Could not look up the user. Check the connection and that you are signed in as an admin.');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  // Step 2 — confirm and credit points
  const handleConfirm = async () => {
    if (!foundUser) return;
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await manualClaimPoints(claimCode.trim().toUpperCase(), foundUser.uid);
      if (res.success && res.result) {
        setResult(res.result);
        setStep('success');
        setClaimCode('');
        setUsername('');
      } else {
        setErrorMsg(res.error ?? 'Unknown error.');
        setStep('error');
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Could not credit the points. Nothing was changed — check the connection and try again.');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep('form');
    setErrorMsg('');
    setFoundUser(null);
    setCandidates([]);
    setResult(null);
    setClaimCode('');
    setUsername('');
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-card via-card to-card/50 border border-border rounded-2xl p-6 hover:border-green/30 transition-all duration-500">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-forest/60 ring-1 ring-green/25 flex items-center justify-center shrink-0">
            <ClipboardCheck className="w-7 h-7 text-green" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Manual Claim</h1>
            <p className="text-white/50 text-sm">Credit points to a user who cannot scan the QR code</p>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-2">
        <h3 className="text-white font-semibold text-sm mb-3">How it works</h3>
        {[
          'User presses R on the bin scanner to show their receipt',
          'User tells you their username and the claim code (ECO-XXXX) on screen',
          'Enter both below — you\'ll see their account to verify',
          'Confirm their Gmail matches, then click Confirm & Credit',
        ].map((s, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-green/20 text-green text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              {i + 1}
            </div>
            <p className="text-white/60 text-sm">{s}</p>
          </div>
        ))}
      </div>

      {/* Form */}
      {(step === 'form' || step === 'error') && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div>
            <label className="text-white/70 text-sm font-semibold block mb-2">Claim Code</label>
            <div className="relative">
              <ClipboardCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={claimCode}
                onChange={e => setClaimCode(e.target.value.toUpperCase())}
                placeholder="e.g. ECO-4829"
                maxLength={8}
                className="w-full bg-bg border border-border rounded-xl pl-11 pr-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-green transition tracking-widest"
              />
            </div>
            <p className="text-white/30 text-xs mt-1">Format: ECO-XXXX (shown on the bin screen)</p>
          </div>

          <div>
            <label className="text-white/70 text-sm font-semibold block mb-2">Username</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. juandelacruz"
                className="w-full bg-bg border border-border rounded-xl pl-11 pr-4 py-3 text-white text-sm focus:outline-none focus:border-green transition"
              />
            </div>
            <p className="text-white/30 text-xs mt-1">The username shown in their ECOReward app profile</p>
          </div>

          {step === 'error' && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
              <XCircle className="w-5 h-5 text-red-400 shrink-0" />
              <p className="text-red-400 text-sm font-medium">{errorMsg}</p>
            </div>
          )}

          <button
            onClick={handleLookup}
            disabled={loading}
            className="w-full bg-green hover:bg-dark-green disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
          >
            {loading
              ? <><Loader2 className="w-5 h-5 animate-spin" /> Looking up...</>
              : <><Search className="w-5 h-5" /> Find Account</>
            }
          </button>
        </div>
      )}

      {/* Confirm step — show found user with email for verification */}
      {step === 'confirm' && !foundUser && candidates.length > 1 && (
        <div className="bg-card border border-orange/30 rounded-2xl p-6 space-y-4">
          <div>
            <h3 className="text-white font-bold text-base">{candidates.length} customers are called &ldquo;{candidates[0].username}&rdquo;</h3>
            <p className="text-white/50 text-sm mt-1">Ask for their email, then choose the matching account.</p>
          </div>
          <div className="space-y-2">
            {candidates.map(c => (
              <button key={c.uid} onClick={() => setFoundUser(c)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-raised border border-border hover:border-green/40 transition text-left">
                <Mail className="w-4 h-4 text-white/40 shrink-0" aria-hidden />
                <span className="text-white text-sm flex-1 truncate">{c.email}</span>
                <span className="text-white/40 text-xs">{c.points} pts</span>
              </button>
            ))}
          </div>
          <button onClick={reset} className="w-full bg-white/5 hover:bg-white/10 text-white font-semibold py-3 rounded-xl transition text-sm">
            Cancel
          </button>
        </div>
      )}

      {step === 'confirm' && foundUser && (
        <div className="bg-card border border-green/30 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-green" />
            <h3 className="text-white font-bold text-base">Verify Account</h3>
          </div>
          <p className="text-white/50 text-sm">Confirm this is the correct user before crediting points.</p>

          {/* User card */}
          <div className="bg-bg border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-green/20 flex items-center justify-center text-green font-bold text-xl">
                {foundUser.username[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-white font-bold text-base">{foundUser.username}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Mail className="w-3 h-3 text-white/40" />
                  <p className="text-white/50 text-sm">{foundUser.email}</p>
                </div>
              </div>
              <div className="ml-auto text-right">
                <p className="text-yellow-400 font-bold text-lg">{foundUser.points}</p>
                <p className="text-white/40 text-xs">current pts</p>
              </div>
            </div>
          </div>

          <p className="text-white/40 text-xs text-center">
            Ask the user to confirm their Gmail: <span className="text-white/70 font-semibold">{foundUser.email}</span>
          </p>

          <div className="flex gap-3">
            <button
              onClick={reset}
              className="flex-1 bg-white/5 hover:bg-white/10 text-white font-semibold py-3 rounded-xl transition text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 bg-green hover:bg-dark-green disabled:opacity-50 text-black font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
            >
              {loading
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
                : <><CheckCircle className="w-5 h-5" /> Confirm & Credit</>
              }
            </button>
          </div>
        </div>
      )}

      {/* Success */}
      {step === 'success' && result && (
        <div className="bg-card border border-green/40 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green shrink-0" />
            <h3 className="text-white font-bold text-lg">Points Credited!</h3>
          </div>

          <div className="bg-bg border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green/20 flex items-center justify-center text-green font-bold text-lg">
                {result.username[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-white font-semibold">{result.username}</p>
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3 h-3 text-white/40" />
                  <p className="text-white/40 text-xs">{result.email}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card border border-border rounded-xl p-3 text-center">
                <Recycle className="w-5 h-5 mx-auto mb-1" style={{ color: WASTE_COLORS[result.wasteType] ?? '#F2EDE3' }} />
                <p className="text-white font-bold text-sm">{result.wasteType}</p>
                <p className="text-white/40 text-xs">Waste Type</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-3 text-center">
                <Star className="w-5 h-5 text-orange-400 mx-auto mb-1" />
                <p className="text-orange-400 font-bold text-lg">+{result.pointsAwarded}</p>
                <p className="text-white/40 text-xs">Points Awarded</p>
              </div>
            </div>
          </div>

          {result.newBadges.length > 0 && (
            <div className="bg-orange/10 border border-orange/30 rounded-xl p-3 text-sm text-white/80">
              New badge{result.newBadges.length > 1 ? 's' : ''}:{' '}
              {result.newBadges.map(id => {
                const b = BADGES.find(x => x.id === id);
                return b ? `${b.icon} ${b.label}` : id;
              }).join(', ')}
            </div>
          )}

          <button
            onClick={reset}
            className="w-full bg-white/5 hover:bg-white/10 text-white font-semibold py-3 rounded-xl transition text-sm"
          >
            Process Another Claim
          </button>
        </div>
      )}
    </div>
  );
}
