'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiClientError } from '@/lib/client';
import { Button, Card, Input } from '@/components/ui';
import { GraduationCap, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api('/api/auth/login', { method: 'POST', body: { username: username.trim(), password } });
      router.replace('/home');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-brand-700 via-brand-600 to-indigo-800 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <GraduationCap className="h-9 w-9" />
          </div>
          <h1 className="text-2xl font-bold">CSE B Class</h1>
          <p className="mt-1 text-sm text-brand-100">One app for your class — timetable, status, assignments & more</p>
        </div>
        <Card className="p-6">
          <form onSubmit={submit} className="space-y-4">
            <Input
              label="Register Number / Staff ID"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. CB22001"
              autoComplete="username"
              autoFocus
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Students: your date of birth (DDMMYYYY) initially"
              autoComplete="current-password"
              required
            />
            {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400" role="alert">{error}</p>}
            <Button type="submit" size="lg" loading={loading} className="w-full">
              Sign in
            </Button>
          </form>
          <div className="mt-5 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <p>
              First time? Sign in with your register number and your date of birth (DDMMYYYY) — you&apos;ll set a new password right after.
              Forgot your password? Contact your Class Advisor.
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}
