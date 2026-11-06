'use client';

// Tells staff the moment a customer redeems a reward, on whatever page they are: a toast with the code and a link
// that opens the code check, plus a desktop notification when the console is in a background tab (if allowed).
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Gift } from 'lucide-react';
import { subscribeToRecentRedemptions } from '@/lib/firebaseService';
import { freshPending, isExpired } from '@/lib/redemptions';
import type { Redemption } from '@/lib/types';

const codeHref = (r: Redemption) => `/rewards?code=${encodeURIComponent(r.redemptionCode)}`;

/** Codes waiting to be handed out right now (pending, not expired), live. */
export function useWaitingCodes(): number {
  const [n, setN] = useState(0);
  useEffect(() => subscribeToRecentRedemptions(list => setN(list.filter(r => r.status === 'pending' && !isExpired(r)).length)), []);
  return n;
}

export default function RedemptionAlerts() {
  const seen = useRef(new Set<string>());
  const loaded = useRef(false);

  useEffect(() => subscribeToRecentRedemptions(list => {
    const fresh = freshPending(seen.current, list, !loaded.current);
    loaded.current = true;
    for (const r of fresh) {
      toast(t => (
        <div className="flex items-start gap-3">
          <Gift className="w-5 h-5 text-green shrink-0 mt-0.5" aria-hidden />
          <div className="text-sm">
            <div className="font-semibold">New redemption: {r.rewardTitle}</div>
            <div className="text-white/60">Code <span className="font-bold tracking-wider text-white">{r.redemptionCode}</span>
              {r.userEmail ? `, ${r.userEmail}` : ''}</div>
            <Link href={codeHref(r)} onClick={() => toast.dismiss(t.id)} className="text-green font-semibold underline underline-offset-2">
              Check this code
            </Link>
          </div>
        </div>
      ), { duration: 15_000, id: `redemption-${r.id}` });
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
        const n = new Notification(`New redemption: ${r.rewardTitle}`, { body: `Code ${r.redemptionCode}`, tag: r.id });
        n.onclick = () => { window.focus(); window.location.href = codeHref(r); };
      }
    }
  }), []);

  return null;
}
