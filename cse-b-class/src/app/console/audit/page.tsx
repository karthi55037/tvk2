'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Badge, Card, Input, Loading } from '@/components/ui';
import { fmtDateTime } from '@/lib/dates';

type Log = { id: string; actorName: string | null; actorRole: string | null; action: string; targetType: string | null; targetId: string | null; metadata: string | null; ip: string | null; createdAt: string };

export default function AuditConsole() {
  const [logs, setLogs] = useState<Log[] | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    api<{ logs: Log[] }>('/api/audit?limit=400').then((r) => setLogs(r.logs)).catch(() => setLogs([]));
  }, []);

  if (!logs) return <Loading />;
  const filtered = logs.filter((l) => !q || l.action.toLowerCase().includes(q.toLowerCase()) || (l.actorName || '').toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Audit logs</h1>
      <p className="text-sm text-slate-400">Immutable record of logins, role changes, decisions, moderation, clearing and administrative actions.</p>
      <Input placeholder="Filter by action or actor…" value={q} onChange={(e) => setQ(e.target.value)} />
      <Card className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 text-left uppercase tracking-wide text-slate-400 dark:border-slate-800">
              <th className="px-3 py-2.5">When</th>
              <th className="px-3 py-2.5">Actor</th>
              <th className="px-3 py-2.5">Action</th>
              <th className="px-3 py-2.5">Target</th>
              <th className="px-3 py-2.5">Details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id} className="border-b border-slate-50 last:border-0 dark:border-slate-800/50">
                <td className="whitespace-nowrap px-3 py-2 text-slate-400">{fmtDateTime(l.createdAt)}</td>
                <td className="px-3 py-2 font-medium">{l.actorName || 'system'} {l.actorRole && <Badge tone="gray">{l.actorRole}</Badge>}</td>
                <td className="px-3 py-2 font-mono">{l.action}</td>
                <td className="px-3 py-2 text-slate-400">{l.targetType || '—'}</td>
                <td className="max-w-[260px] truncate px-3 py-2 text-slate-400">{l.metadata || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No entries.</p>}
      </Card>
    </div>
  );
}
