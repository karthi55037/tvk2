'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Badge, Card, Loading } from '@/components/ui';
import { useAuth } from '@/components/providers';

type Summary = { advisor: { name: string } | null; representatives: unknown[]; admins: { name: string; username: string }[] };

export default function SettingsConsole() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pushKey, setPushKey] = useState<string | null>(null);

  useEffect(() => {
    api<Summary>('/api/roles').then(setSummary).catch(() => setSummary({ advisor: null, representatives: [], admins: [] }));
    api<{ publicKey: string | null }>('/api/push').then((r) => setPushKey(r.publicKey)).catch(() => setPushKey(null));
  }, []);

  if (!summary) return <Loading />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Card className="p-4">
        <h2 className="font-semibold">Class configuration</h2>
        <ul className="mt-2 space-y-1.5 text-sm text-slate-500">
          <li>Advisor: {summary.advisor ? summary.advisor.name : 'none'}</li>
          <li>Representatives: {summary.representatives.length}/4</li>
          <li>Administrators: {summary.admins.map((a) => a.name).join(', ')}</li>
          <li>Push notifications (VAPID): {pushKey ? <Badge tone="green">configured</Badge> : <Badge tone="amber">not configured — set VAPID keys in .env</Badge>}</li>
          <li>Session model: 15-minute access tokens + 7-day sliding refresh, httpOnly cookies</li>
          <li>Passwords: bcrypt (cost 11); initial student password = DOB (DDMMYYYY), forced change at first login</li>
          <li>Uploads: allow-listed types, magic-byte check, size limit from MAX_UPLOAD_MB, authorized access only</li>
        </ul>
      </Card>
      <Card className="p-4">
        <h2 className="font-semibold">Recovery playbook</h2>
        <ul className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-500">
          <li>Student locked out → Students page → reset icon → share the one-time temp password out-of-band.</li>
          <li>Advisor unavailable → Representatives or Admins can reassign the Advisor from Roles.</li>
          <li>Inappropriate class chat → representatives report → clearing request needs Advisor + all Reps + Admin (§19); Admin emergency takedown available and audit-logged.</li>
          <li>Database: apply migrations with <code>npm run db:migrate</code>; files live in STORAGE_DIR — back up both.</li>
        </ul>
      </Card>
      <p className="text-xs text-slate-400">Signed in as {user?.name} ({user?.role}). Least privilege: admins do not see private leave/OD reasons or student DOB/address.</p>
    </div>
  );
}
