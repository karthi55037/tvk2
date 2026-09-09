'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, onRealtime } from '@/lib/client';
import { TopBar } from '@/components/nav';
import { Badge, Card, EmptyState, Loading, useToast } from '@/components/ui';
import { fmtDateTime } from '@/lib/dates';
import { Archive, ChevronRight, FolderOpen } from 'lucide-react';

type Folder = {
  id: string;
  number: number;
  status: string;
  itemCount: number;
  subjects: { id: string; subjectName: string; deadline: string | null }[];
};

export default function AssignmentsPage() {
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const toast = useToast();

  const load = useCallback(() => {
    api<{ folders: Folder[] }>('/api/assignments/folders').then((r) => setFolders(r.folders)).catch((e) => toast.push('error', e.message));
  }, [toast]);
  useEffect(load, [load]);
  useEffect(() => onRealtime('assignments', load), [load]);

  if (!folders) return <Loading />;
  const active = folders.filter((f) => f.status === 'ACTIVE');
  const completed = folders.filter((f) => f.status === 'COMPLETED');

  return (
    <>
      <TopBar title="Assignments" />
      <main className="mx-auto max-w-2xl space-y-5 p-4">
        <section>
          <h2 className="mb-2 text-sm font-bold text-slate-500">ACTIVE</h2>
          {active.length === 0 ? (
            <Card><EmptyState icon={<FolderOpen className="h-10 w-10" />} title="No active assignments" subtitle="New assignments from your subjects will appear here." /></Card>
          ) : (
            <div className="space-y-2">
              {active.map((f) => (
                <Link key={f.id} href={`/assignments/${f.id}`}>
                  <Card className="flex items-center justify-between p-4 transition hover:border-brand-300">
                    <div>
                      <p className="font-semibold">Assignment {f.number}</p>
                      <p className="text-xs text-slate-500">{f.itemCount} subject{f.itemCount === 1 ? '' : 's'} · first assignment of each subject</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {completed.length > 0 && (
          <section>
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-500"><Archive className="h-4 w-4" /> COMPLETED ASSIGNMENTS</h2>
            <div className="space-y-2">
              {completed.map((f) => (
                <Link key={f.id} href={`/assignments/${f.id}`}>
                  <Card className="flex items-center justify-between p-4 opacity-75 transition hover:opacity-100">
                    <div>
                      <p className="font-semibold">Assignment {f.number}</p>
                      <p className="text-xs text-slate-500">{f.itemCount} subjects · records retained</p>
                    </div>
                    <Badge tone="gray">Completed</Badge>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
