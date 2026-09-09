'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Badge, Button, Card, EmptyState, Loading, StatusPill, useToast } from '@/components/ui';
import { OD_STATUS_LABEL, STATUS_TONE } from '@/lib/format';
import { fmtDateTime } from '@/lib/dates';

type OD = { id: string; userName: string; programName: string; place: string; date: string; fromTime: string; toTime: string; reason: string; status: string; withdrawalRequested: boolean; createdAt: string };

export default function ODConsole() {
  const toast = useToast();
  const [rows, setRows] = useState<OD[] | null>(null);

  const load = useCallback(() => {
    api<{ requests: OD[] }>('/api/od').then((r) => setRows(r.requests)).catch((e) => toast.push('error', e.message));
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
        <h1 className="text-2xl font-bold">OD management</h1>
        <p className="text-sm text-slate-400">Only the Advisor approves/rejects OD. Representatives confirm letter completion afterwards.</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-slate-500">ACTION QUEUE ({pending.length})</h2>
        {pending.length === 0 && <Card><EmptyState title="Queue is clear" /></Card>}
        {pending.map((r) => (
          <Card key={r.id} className="space-y-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{r.userName} <span className="text-sm font-normal text-slate-500">· {r.programName}</span></p>
              <div className="flex items-center gap-2">
                {r.withdrawalRequested && <Badge tone="amber">withdrawal requested</Badge>}
                <StatusPill value={r.status} label={OD_STATUS_LABEL[r.status]} tone={STATUS_TONE} />
              </div>
            </div>
            <p className="text-sm text-slate-500">{r.place} · {r.date} · {r.fromTime}–{r.toTime}</p>
            <p className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">{r.reason}</p>
            <p className="text-[11px] text-slate-400">Submitted {fmtDateTime(r.createdAt)}</p>
            <div className="flex gap-2">
              {r.status === 'PENDING' && (
                <>
                  <Button size="sm" variant="success" onClick={() => act(r.id, () => api(`/api/od/${r.id}/decide`, { method: 'POST', body: { decision: 'APPROVE' } }), 'OD approved — letter required')}>Approve</Button>
                  <Button size="sm" variant="danger" onClick={() => act(r.id, () => api(`/api/od/${r.id}/decide`, { method: 'POST', body: { decision: 'REJECT' } }), 'Rejected')}>Reject</Button>
                </>
              )}
              {r.withdrawalRequested && (
                <>
                  <Button size="sm" variant="danger" onClick={() => act(r.id, () => api(`/api/od/${r.id}/withdraw`, { method: 'PUT', body: { approve: true } }), 'OD withdrawn')}>Approve withdrawal</Button>
                  <Button size="sm" variant="secondary" onClick={() => act(r.id, () => api(`/api/od/${r.id}/withdraw`, { method: 'PUT', body: { approve: false } }), 'Withdrawal declined')}>Decline</Button>
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
                <p className="text-sm font-medium">{r.userName} · {r.programName} · {r.date}</p>
                <StatusPill value={r.status} label={OD_STATUS_LABEL[r.status]} tone={STATUS_TONE} />
              </li>
            ))}
            {decided.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No history yet.</p>}
          </ul>
        </Card>
      </section>
    </div>
  );
}
