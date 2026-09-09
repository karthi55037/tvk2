'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Badge, Button, Card, EmptyState, Loading, useToast } from '@/components/ui';
import { fmtDateTime } from '@/lib/dates';

type Visit = { id: string; studentName: string; regNo: string | null; teacherName: string; location: string; reason: string; outAt: string; expectedReturnAt: string; returnStatus: string; returnedAt: string | null };

export default function VisitsConsole() {
  const toast = useToast();
  const [visits, setVisits] = useState<Visit[] | null>(null);

  const load = useCallback(() => {
    api<{ visits: Visit[] }>('/api/visits').then((r) => setVisits(r.visits)).catch((e) => toast.push('error', e.message));
  }, [toast]);
  useEffect(load, [load]);

  if (!visits) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Teacher visit records</h1>
        <a href="/more/visits" className="rounded-xl bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">Create in class app →</a>
      </div>
      {visits.length === 0 && <Card><EmptyState title="No visit records" /></Card>}
      <div className="space-y-2">
        {visits.map((v) => (
          <Card key={v.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
            <div>
              <p className="font-medium">{v.teacherName} → {v.studentName} <span className="text-xs text-slate-400">{v.regNo}</span></p>
              <p className="text-xs text-slate-500">{v.location} · {v.reason}</p>
              <p className="text-[11px] text-slate-400">Left {fmtDateTime(v.outAt)} · expected back {fmtDateTime(v.expectedReturnAt)}{v.returnedAt ? ` · returned ${fmtDateTime(v.returnedAt)}` : ''}</p>
            </div>
            <Badge tone={v.returnStatus === 'RETURNED' ? 'green' : 'amber'}>{v.returnStatus}</Badge>
          </Card>
        ))}
      </div>
    </div>
  );
}
