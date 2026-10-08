'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { Gift, Plus, Edit2, Trash2, Check, Coffee, Utensils, Tag as TagIcon, HourglassIcon, CheckCircle, Download, LucideIcon } from 'lucide-react';
import { subscribeToRewards, subscribeToRedemptions, addReward, updateReward, deleteReward, markRedemptionClaimed, exportToCSV } from '@/lib/firebaseService';
import { Reward, Redemption, RewardCategory } from '@/lib/types';
import ConfirmModal from '@/components/ConfirmModal';
import toast from 'react-hot-toast';

const CATEGORY_ICONS: Record<RewardCategory, LucideIcon> = {
  Coffee, Food: Utensils, Discount: TagIcon, Other: Gift,
};

export default function RewardsPage() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [activeTab, setActiveTab] = useState<'rewards' | 'redemptions'>('rewards');
  const [showForm, setShowForm] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Reward | null>(null);
  const [ready, setReady] = useState({ rewards: false, redemptions: false });

  useEffect(() => {
    const unsubRewards = subscribeToRewards(data => { setRewards(data); setReady(r => ({ ...r, rewards: true })); });
    const unsubRedemptions = subscribeToRedemptions(data => { setRedemptions(data); setReady(r => ({ ...r, redemptions: true })); });
    return () => { unsubRewards(); unsubRedemptions(); };
  }, []);

  const loading = !ready.rewards || !ready.redemptions;
  const pendingCount = redemptions.filter(r => r.status === 'pending').length;

  const handleConfirmDelete = async () => {
    if (!deleteTarget?.id) return;
    await deleteReward(deleteTarget.id);
    toast.success('Reward deleted');
    setDeleteTarget(null);
  };

  const handleMarkClaimed = async (redemption: Redemption) => {
    await markRedemptionClaimed(redemption.id!);
    toast.success(`"${redemption.rewardTitle}" marked as claimed`);
  };

  const handleExport = () => {
    exportToCSV(
      redemptions.map(r => ({
        'User Email': r.userEmail,
        Reward: r.rewardTitle,
        'Points Used': r.pointsUsed,
        Code: r.redemptionCode,
        Status: r.status,
        Date: new Date(r.redeemedAt).toLocaleDateString(),
      })),
      'ecoreward-redemptions.csv'
    );
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">Rewards Manager</h1>
          {activeTab === 'rewards' ? (
            <button
              onClick={() => { setEditingReward(null); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-green/10 border border-green/30 rounded-btn text-green font-bold hover:bg-green/20 transition"
            >
              <Plus className="w-4 h-4" />
              Add Reward
            </button>
          ) : (
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-green/10 border border-green/30 rounded-btn text-green font-bold hover:bg-green/20 transition"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          )}
        </div>

        <div className="flex gap-6 border-b border-border">
          {(['rewards', 'redemptions'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-2 font-bold text-sm transition relative flex items-center gap-2 ${activeTab === tab ? 'text-green' : 'text-white/40'}`}
            >
              {tab === 'rewards' ? `Rewards (${rewards.length})` : 'Redemptions'}
              {tab === 'redemptions' && pendingCount > 0 && (
                <span className="px-2 py-0.5 bg-orange rounded-full text-white text-xs font-bold">{pendingCount}</span>
              )}
              {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green" />}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'rewards' ? (
        rewards.length === 0 ? (
          <EmptyState icon={Gift} message="No rewards yet" />
        ) : (
          <div className="space-y-3">
            {rewards.map(reward => (
              <RewardCard
                key={reward.id}
                reward={reward}
                onEdit={r => { setEditingReward(r); setShowForm(true); }}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        )
      ) : (
        <RedemptionsTab redemptions={redemptions} onMarkClaimed={handleMarkClaimed} />
      )}

      {showForm && (
        <RewardForm
          reward={editingReward}
          onClose={() => { setShowForm(false); setEditingReward(null); }}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Reward"
          message={`Are you sure you want to delete "${deleteTarget.title}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: LucideIcon; message: string }) {
  return (
    <div className="bg-card border border-border rounded-card p-12 text-center">
      <Icon className="w-16 h-16 text-white/20 mx-auto mb-4" />
      <p className="text-white/40">{message}</p>
    </div>
  );
}

interface RewardCardProps { reward: Reward; onEdit: (r: Reward) => void; onDelete: (r: Reward) => void }
function RewardCard({ reward, onEdit, onDelete }: RewardCardProps) {
  const Icon = CATEGORY_ICONS[reward.category as RewardCategory] ?? Gift;
  return (
    <div className={`bg-card border rounded-card p-4 flex items-center gap-4 ${reward.isActive ? 'border-green/20' : 'border-border'}`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${reward.isActive ? 'bg-green/10 border border-green/30' : 'bg-white/5 border border-border'}`}>
        <Icon className={`w-6 h-6 ${reward.isActive ? 'text-green' : 'text-white/30'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={`font-bold text-sm ${reward.isActive ? 'text-white' : 'text-white/40'}`}>{reward.title}</span>
          {!reward.isActive && (
            <span className="px-2 py-0.5 bg-red-500/10 border border-red-500/30 rounded text-red-500 text-xs font-bold">Inactive</span>
          )}
        </div>
        <p className="text-white/40 text-xs mb-2 truncate">{reward.description}</p>
        <div className="flex items-center gap-3">
          <span className="text-amber-400 text-xs font-bold">⭐ {reward.pointsCost} pts</span>
          <span className="px-2 py-0.5 bg-white/5 rounded text-white/40 text-xs">{reward.category}</span>
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <button onClick={() => onEdit(reward)} className="p-2 bg-blue/10 border border-blue/30 rounded-xl text-blue hover:bg-blue/20 transition">
          <Edit2 className="w-4 h-4" />
        </button>
        <button onClick={() => onDelete(reward)} className="p-2 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 hover:bg-red-500/20 transition">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

interface RedemptionsTabProps { redemptions: Redemption[]; onMarkClaimed: (r: Redemption) => void }
function RedemptionsTab({ redemptions, onMarkClaimed }: RedemptionsTabProps) {
  const pending = redemptions.filter(r => r.status === 'pending');
  const claimed = redemptions.filter(r => r.status === 'claimed');

  if (redemptions.length === 0) return <EmptyState icon={CheckCircle} message="No redemptions yet" />;

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 bg-orange rounded" />
            <span className="text-orange font-bold text-sm">Pending Approval</span>
            <span className="px-2 py-0.5 bg-orange/10 rounded-full text-orange text-xs font-bold">{pending.length}</span>
          </div>
          <div className="space-y-3">
            {pending.map(r => <RedemptionCard key={r.id} redemption={r} onMarkClaimed={onMarkClaimed} />)}
          </div>
        </div>
      )}
      {claimed.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 bg-green rounded" />
            <span className="text-green font-bold text-sm">Claimed</span>
            <span className="px-2 py-0.5 bg-green/10 rounded-full text-green text-xs font-bold">{claimed.length}</span>
          </div>
          <div className="space-y-3">
            {claimed.map(r => <RedemptionCard key={r.id} redemption={r} />)}
          </div>
        </div>
      )}
    </div>
  );
}

interface RedemptionCardProps { redemption: Redemption; onMarkClaimed?: (r: Redemption) => void }
function RedemptionCard({ redemption, onMarkClaimed }: RedemptionCardProps) {
  const isPending = redemption.status === 'pending';
  return (
    <div className={`bg-card border rounded-card p-4 ${isPending ? 'border-orange/30' : 'border-border'}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${isPending ? 'bg-orange/10' : 'bg-green/10'}`}>
          {isPending ? <HourglassIcon className="w-5 h-5 text-orange" /> : <CheckCircle className="w-5 h-5 text-green" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white font-bold text-sm truncate">{redemption.rewardTitle}</div>
          <div className="text-white/40 text-xs truncate">{redemption.userEmail || redemption.userId.substring(0, 8)}</div>
        </div>
        <div className="text-red-500 font-bold text-sm shrink-0">-{redemption.pointsUsed} pts</div>
      </div>
      <div className="bg-bg border border-border rounded-xl p-3 mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white/40 text-xs">
            <TagIcon className="w-3 h-3" />
            <span>Code:</span>
            <span className="text-white font-bold tracking-wider">{redemption.redemptionCode}</span>
          </div>
          <span className="text-white/30 text-xs">{new Date(redemption.redeemedAt).toLocaleDateString()}</span>
        </div>
      </div>
      {isPending && onMarkClaimed && (
        <button
          onClick={() => onMarkClaimed(redemption)}
          className="w-full bg-green hover:bg-dark-green text-black font-bold py-2.5 rounded-btn transition flex items-center justify-center gap-2"
        >
          <Check className="w-4 h-4" />
          Mark as Claimed
        </button>
      )}
    </div>
  );
}

interface RewardFormProps { reward: Reward | null; onClose: () => void }
function RewardForm({ reward, onClose }: RewardFormProps) {
  const [title, setTitle] = useState(reward?.title ?? '');
  const [description, setDescription] = useState(reward?.description ?? '');
  const [pointsCost, setPointsCost] = useState(String(reward?.pointsCost ?? ''));
  const [category, setCategory] = useState<RewardCategory>(reward?.category ?? 'Coffee');
  const [isActive, setIsActive] = useState(reward?.isActive ?? true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = { title, description, pointsCost: parseInt(pointsCost), category, isActive };
      if (reward?.id) {
        await updateReward(reward.id, data);
        toast.success('Reward updated');
      } else {
        await addReward(data);
        toast.success('Reward added');
      }
      onClose();
    } catch {
      toast.error('Failed to save reward');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-card p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-white font-bold text-lg mb-6">{reward ? 'Edit Reward' : 'Add New Reward'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" className="w-full bg-bg border border-border rounded-btn px-4 py-3 text-white focus:outline-none focus:border-green" required />
          <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" className="w-full bg-bg border border-border rounded-btn px-4 py-3 text-white focus:outline-none focus:border-green" required />
          <input type="number" value={pointsCost} onChange={e => setPointsCost(e.target.value)} placeholder="Points Cost" min="1" className="w-full bg-bg border border-border rounded-btn px-4 py-3 text-white focus:outline-none focus:border-green" required />
          <select value={category} onChange={e => setCategory(e.target.value as RewardCategory)} className="w-full bg-bg border border-border rounded-btn px-4 py-3 text-white focus:outline-none focus:border-green">
            {(['Coffee', 'Food', 'Discount', 'Other'] as RewardCategory[]).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className="flex items-center gap-3 p-3 bg-bg border border-border rounded-btn cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="w-5 h-5 accent-green" />
            <span className="text-white/70 text-sm">Active (visible to customers)</span>
          </label>
          <button type="submit" disabled={loading} className="w-full bg-green hover:bg-dark-green text-black font-bold py-3 rounded-btn transition disabled:opacity-50">
            {loading ? 'Saving...' : reward ? 'Save Changes' : 'Add Reward'}
          </button>
        </form>
      </div>
    </div>
  );
}
