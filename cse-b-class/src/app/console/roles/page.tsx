'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Badge, Button, Card, Input, Loading, Modal, useToast, ConfirmButton } from '@/components/ui';
import { useAuth } from '@/components/providers';

type Summary = {
  advisor: { id: string; name: string; username: string } | null;
  representatives: { id: string; name: string; regNo: string | null }[];
  admins: { id: string; name: string; username: string }[];
};
type Row = { id: string; name: string; regNo: string | null };

export default function RolesConsole() {
  const { user } = useAuth();
  const toast = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [students, setStudents] = useState<Row[]>([]);
  const [addRepOpen, setAddRepOpen] = useState(false);
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [form, setForm] = useState({ name: '', username: '', tempPassword: '' });
  const [repId, setRepId] = useState('');

  const canManageAdmins = user?.role === 'ADMIN';
  const canSetAdvisor = user?.role === 'REPRESENTATIVE' || user?.role === 'ADMIN';

  const load = useCallback(() => {
    api<Summary>('/api/roles').then(setSummary).catch((e) => toast.push('error', e.message));
    api<{ students: Row[] }>('/api/students').then((r) => setStudents(r.students)).catch(() => {});
  }, [toast]);
  useEffect(load, [load]);

  async function call(fn: () => Promise<unknown>, ok: string) {
    try {
      const r = (await fn()) as { temporaryPassword?: string };
      toast.push('success', r?.temporaryPassword ? `${ok} — temp password: ${r.temporaryPassword}` : ok);
      load();
      return true;
    } catch (e) {
      toast.push('error', (e as Error).message);
      return false;
    }
  }

  if (!summary) return <Loading />;
  const repIds = new Set(summary.representatives.map((r) => r.id));
  const candidates = students.filter((s) => !repIds.has(s.id));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Roles</h1>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Class Advisor (0–1)</h2>
            {summary.advisor ? (
              <p className="mt-0.5 text-sm text-slate-500">{summary.advisor.name} · {summary.advisor.username}</p>
            ) : (
              <p className="mt-0.5 text-sm text-slate-400">No advisor assigned</p>
            )}
          </div>
          {canSetAdvisor && (
            summary.advisor ? (
              <ConfirmButton question="Remove the Class Advisor? They will be moved to the administrators group." onConfirm={() => call(() => api('/api/roles/advisor', { method: 'DELETE' }), 'Advisor removed')}>
                Remove
              </ConfirmButton>
            ) : (
              <Button onClick={() => { setForm({ name: '', username: '', tempPassword: '' }); setAdvisorOpen(true); }}>Add advisor</Button>
            )
          )}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Representatives ({summary.representatives.length}/4)</h2>
          {(user?.role === 'ADVISOR' || user?.role === 'ADMIN' || user?.role === 'REPRESENTATIVE') && summary.representatives.length < 4 && (
            <Button variant="secondary" onClick={() => setAddRepOpen(true)}>Add representative</Button>
          )}
        </div>
        {summary.representatives.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">No representatives. {summary.advisor ? 'The Advisor can add one.' : 'An App Administrator can add one.'}</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
            {summary.representatives.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2.5">
                <p className="text-sm font-medium">{r.name} <span className="text-xs text-slate-400">{r.regNo}</span></p>
                <div className="flex gap-2">
                  {!(user?.role === 'REPRESENTATIVE' && user.id === r.id) && (
                    <ConfirmButton question={`Remove ${r.name} as representative? They become a regular student.`} onConfirm={() => call(() => api(`/api/roles/representatives/${r.id}`, { method: 'DELETE' }), 'Representative removed')}>
                      Remove
                    </ConfirmButton>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-slate-400">Reps can add/remove other representatives; the Advisor and Admins can too. Every change is audit-logged.</p>
      </Card>

      {canManageAdmins && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">App Administrators ({summary.admins.length})</h2>
            <Button variant="secondary" onClick={() => { setForm({ name: '', username: '', tempPassword: '' }); setAdminOpen(true); }}>Add admin</Button>
          </div>
          <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
            {summary.admins.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2.5">
                <p className="text-sm font-medium">{a.name} <span className="text-xs text-slate-400">{a.username}</span></p>
                {summary.admins.length > 1 && (
                  <ConfirmButton question={`Deactivate administrator ${a.name}?`} onConfirm={() => call(() => api(`/api/roles/admins/${a.id}`, { method: 'DELETE' }), 'Admin deactivated')}>
                    Deactivate
                  </ConfirmButton>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal open={addRepOpen} onClose={() => setAddRepOpen(false)} title="Add representative">
        <div className="space-y-3">
          <select value={repId} onChange={(e) => setRepId(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800" aria-label="Select student">
            <option value="">Select a student…</option>
            {candidates.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.regNo})</option>
            ))}
          </select>
          <Button
            className="w-full"
            disabled={!repId}
            onClick={async () => {
              if (await call(() => api('/api/roles/representatives', { method: 'POST', body: { userId: repId } }), 'Representative added')) setAddRepOpen(false);
            }}
          >
            Add as representative
          </Button>
        </div>
      </Modal>

      <Modal open={advisorOpen} onClose={() => setAdvisorOpen(false)} title="Assign Class Advisor">
        <div className="space-y-3">
          <Input label="Advisor full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Login username (staff ID)" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <Input label="Temporary password (optional)" value={form.tempPassword} onChange={(e) => setForm({ ...form, tempPassword: e.target.value })} />
          <Button
            className="w-full"
            disabled={!form.name || !form.username}
            onClick={async () => {
              if (await call(() => api('/api/roles/advisor', { method: 'POST', body: form }), 'Advisor created')) setAdvisorOpen(false);
            }}
          >
            Create advisor account
          </Button>
        </div>
      </Modal>

      <Modal open={adminOpen} onClose={() => setAdminOpen(false)} title="Add administrator">
        <div className="space-y-3">
          <Input label="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Username / identifier" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <Input label="Temporary password (optional)" value={form.tempPassword} onChange={(e) => setForm({ ...form, tempPassword: e.target.value })} />
          <Button
            className="w-full"
            disabled={!form.name || !form.username}
            onClick={async () => {
              if (await call(() => api('/api/roles/admins', { method: 'POST', body: form }), 'Admin added')) setAdminOpen(false);
            }}
          >
            Create admin
          </Button>
        </div>
      </Modal>
    </div>
  );
}
