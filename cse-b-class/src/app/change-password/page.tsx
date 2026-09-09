'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiClientError } from '@/lib/client';
import { Button, Card, Input, useToast } from '@/components/ui';
import { useAuth } from '@/components/providers';
import { KeyRound } from 'lucide-react';

export default function ChangePasswordPage() {
  const { user, reload, logout } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (next !== confirm) {
      setError('New passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api('/api/auth/change-password', { method: 'POST', body: { currentPassword: current, newPassword: next } });
      await reload();
      toast.push('success', 'Password updated — welcome aboard!');
      router.replace('/home');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not change password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <Card className="w-full max-w-md p-6">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold">Set your new password</h1>
          <p className="mt-1 text-sm text-slate-500">
            {user ? `Hi ${user.name}` : ''} — for security, please replace your initial password before continuing.
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Input label="Current password" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoFocus autoComplete="current-password" />
          <Input label="New password" type="password" value={next} onChange={(e) => setNext(e.target.value)} minLength={8} required autoComplete="new-password" />
          <Input label="Confirm new password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={8} required autoComplete="new-password" />
          {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400" role="alert">{error}</p>}
          <Button type="submit" size="lg" loading={loading} className="w-full">
            Save password
          </Button>
          <button type="button" onClick={() => void logout()} className="w-full text-center text-sm text-slate-400 hover:text-slate-600">
            Sign out instead
          </button>
        </form>
      </Card>
    </main>
  );
}
