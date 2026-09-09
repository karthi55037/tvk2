'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Badge, Button, Card, EmptyState, Loading, StatusPill, useToast, ConfirmButton } from '@/components/ui';
import { LEAVE_STATUS_LABEL, STATUS_TONE } from '@/lib/format';
import { fmtDateTime } from '@/lib/dates';

type Leave = { id: string; userName: string; fromDate: string; toDate: string; reason: string; status: string; withdrawalRequested: boolean; createdAt: string; decisionNote: string | null };

export default function LeaveConsole() {
  const toast = useToast();
  const [rows, setRows] = useState<Leave[] | null>(null);

  const load = useCallback(() => {
    api<{ requests: Leave[] }>('/api/leave').then((r) => setRows(r.requests)).catch((e) => toast.push('error', e.message));
  }, [toast]);
  useEffect(load, [load]);

  async function act(id: string, fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast.push('success', ok);
      load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  if (!rows) return <Loading />;
  const pending = rows.filter((r) => r.status === 'PENDING' || r.withdrawalRequested);
  const decided = rows.filter((r) => r.status !== 'PENDING' && !r.withdrawalRequested);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Leave management</h1>
        <p className="text-sm text-slate-400">Reasons are private to the Advisor. Approval starts the letter flow; any one Representative confirms the letter.</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-slate-500">ACTION QUEUE ({pending.length})</h2>
        {pending.length === 0 && <Card><EmptyState title="Queue is clear" /></Card>}
        {pending.map((r) => (
          <Card key={r.id} className="space-y-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{r.userName} <span className="text-sm font-normal text-slate-500">· {r.fromDate} → {r.toDate}</span></p>
              <div className="flex items-center gap-2">
                {r.withdrawalRequested && <Badge tone="amber">withdrawal requested</Badge>}
                <StatusPill value={r.status} label={LEAVE_STATUS_LABEL[r.status]} tone={STATUS_TONE} />
              </div>
            </div>
            <p className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">{r.reason}</p>
            <p className="text-[11px] text-slate-400">Submitted {fmtDateTime(r.createdAt)}</p>
            <div className="flex gap-2">
              {r.status === 'PENDING' && !r.withdrawalRequested && (
                <>
                  <Button size="sm" variant="success" onClick={() => act(r.id, () => api(`/api/leave/${r.id}/decide`, { method: 'POST', body: { decision: 'APPROVE' } }), 'Approved — letter flow started')}>Approve</Button>
                  <Button size="sm" variant="danger" onClick={() => act(r.id, () => api(`/api/leave/${r.id}/decide`, { method: 'POST', body: { decision: 'REJECT' } }), 'Rejected')}>Reject</Button>
                </>
              )}
              {r.withdrawalRequested && (
                <>
                  <Button size="sm" variant="danger" onClick={() => act(r.id, () => api(`/api/leave/${r.id}/withdraw`, { method: 'PUT', body: { approve: true } }), 'Leave withdrawn')}>Approve withdrawal</Button>
                  <Button size="sm" variant="secondary" onClick={() => act(r.id, () => api(`/api/leave/${r.id}/withdraw`, { method: 'PUT', body: { approve: false } }), 'Withdrawal declined')}>Decline</Button>
                </>
              )}
            </div>
          </Card>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-slate-500">HISTORY</h2>
        <Card>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {decided.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{r.userName} · {r.fromDate} → {r.toDate}</p>
                  <p className="text-xs text-slate-400">{r.status === 'REJECTED' || r.status === 'WITHDRAWN' ? '—' : 'letter flow: posted → rep confirmation'}</p>
                </div>
                <StatusPill value={r.status} label={LEAVE_STATUS_LABEL[r.status]} tone={STATUS_TONE} />
              </li>
            ))}
            {decided.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No history yet.</p>}
          </ul>
        </Card>
      </section>
    </div>
  );
}
