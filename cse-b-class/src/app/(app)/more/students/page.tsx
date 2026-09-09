'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { TopBar } from '@/components/nav';
import { Badge, Card, Input, Loading } from '@/components/ui';
import { Phone } from 'lucide-react';

type Row = { id: string; name: string; regNo: string | null; mobile: string | null; bloodGroup?: string | null; role: string };

export default function DirectoryPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    api<{ students: Row[] }>('/api/students').then((r) => setRows(r.students)).catch(() => setRows([]));
  }, []);

  if (!rows) return <Loading />;
  const filtered = rows.filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()) || (r.regNo || '').toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <TopBar title="Class Directory" />
      <main className="mx-auto max-w-2xl space-y-3 p-4">
        <Input placeholder="Search name or register number…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search students" />
        <p className="text-xs text-slate-400">Showing only permitted information. DOB, address and blood group of classmates stay private.</p>
        <Card className="divide-y divide-slate-100 dark:divide-slate-800">
          {filtered.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium">
                  {r.name}
                  {r.role === 'REPRESENTATIVE' && <Badge tone="brand">Rep</Badge>}
                </p>
                <p className="text-xs text-slate-400">{r.regNo}</p>
              </div>
              <div className="flex items-center gap-3">
                {r.bloodGroup && <span className="text-xs text-slate-400">{r.bloodGroup}</span>}
                {r.mobile && (
                  <a href={`tel:${r.mobile}`} className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-brand-700 dark:bg-slate-800 dark:text-brand-400">
                    <Phone className="h-3 w-3" /> Call
                  </a>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No students found.</p>}
        </Card>
      </main>
    </>
  );
}
