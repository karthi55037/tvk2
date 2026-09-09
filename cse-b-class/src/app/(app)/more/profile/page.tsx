'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { TopBar } from '@/components/nav';
import { Button, Card, Input, Loading, useToast } from '@/components/ui';
import { useAuth } from '@/components/providers';

type Profile = {
  id: string;
  username: string;
  regNo: string | null;
  name: string;
  email: string | null;
  dob: string | null;
  bloodGroup: string | null;
  address: string | null;
  mobile: string | null;
  role: string;
};

export default function ProfilePage() {
  const { user } = useAuth();
  const toast = useToast();
  const [p, setP] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isAdvisor = user?.role === 'ADVISOR';

  const load = useCallback(() => {
    setLoadError(null);
    // /api/auth/me returns the caller's own profile for every role
    api<{ user: Profile }>('/api/auth/me')
      .then((r) => setP(r.user))
      .catch((e) => setLoadError((e as Error).message || 'Could not load your profile'));
  }, []);

  useEffect(load, [load]);

  async function save() {
    if (!p) return;
    setSaving(true);
    try {
      // Server enforces the editable-field matrix; only send what this role may change.
      const body: Record<string, string | undefined> = {
        mobile: p.mobile || undefined,
        address: p.address || undefined,
        bloodGroup: p.bloodGroup || undefined,
        email: p.email || undefined,
      };
      if (isAdvisor) {
        body.name = p.name || undefined;
        body.dob = p.dob || undefined;
      }
      await api('/api/students/' + p.id, { method: 'PATCH', body });
      toast.push('success', isAdvisor ? 'Profile updated' : 'Profile updated — your Advisor has been notified');
      load();
    } catch (e) {
      toast.push('error', (e as Error).message || 'Could not save your profile');
    } finally {
      setSaving(false);
    }
  }

  if (loadError && !p) {
    return (
      <>
        <TopBar title="My Profile" />
        <main className="mx-auto max-w-2xl space-y-4 p-4">
          <Card className="space-y-3 p-6 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">{loadError}</p>
            <Button onClick={load} variant="secondary" className="mx-auto">Try again</Button>
          </Card>
        </main>
      </>
    );
  }
  if (!p) return <Loading />;

  const set = (k: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement>) => setP({ ...p, [k]: e.target.value });
  const canEdit = (k: 'name' | 'dob') => isAdvisor; // students: register no & DOB are college-managed; name changes go through the Advisor

  return (
    <>
      <TopBar title="My Profile" />
      <main className="mx-auto max-w-2xl space-y-4 p-4">
        <Card className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Register number" value={p.regNo || p.username} disabled />
            <Input label="Role" value={p.role} disabled />
            <Input label="Full name" value={p.name} onChange={set('name')} disabled={!canEdit('name')} className={!canEdit('name') ? 'opacity-90' : ''} />
            <Input label="Date of birth" value={p.dob || ''} onChange={set('dob')} disabled={!canEdit('dob')} placeholder="—" />
            <Input label="Blood group" value={p.bloodGroup || ''} onChange={set('bloodGroup')} placeholder="e.g. O+" />
            <Input label="Mobile number" value={p.mobile || ''} onChange={set('mobile')} placeholder="10-digit mobile" />
            <Input label="Email (optional)" value={p.email || ''} onChange={set('email')} type="email" />
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Address</span>
            <textarea
              rows={2}
              value={p.address || ''}
              onChange={(e) => setP({ ...p, address: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              maxLength={500}
            />
          </label>
          <p className="text-xs text-slate-400">
            {isAdvisor
              ? 'As Class Advisor you can edit your own record here, and any student\'s information from the Students console.'
              : 'You can edit your own contact details. Register number and date of birth are managed by the college. Your Advisor is notified of every change.'}
          </p>
          <Button onClick={save} loading={saving} className="w-full">Save changes</Button>
        </Card>
      </main>
    </>
  );
}
