'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, onRealtime } from '@/lib/client';
import { TopBar } from '@/components/nav';
import { Badge, Card, EmptyState, Loading, StatusPill, useToast } from '@/components/ui';
import { fmtDateTime } from '@/lib/dates';
import { STATUS_TONE } from '@/lib/format';
import { ChevronRight } from 'lucide-react';

type Item = {
  id: string;
  subjectName: string;
  subjectCode: string;
  title: string;
  deadline: string | null;
  myStatus: string | null;
  submitted: number;
  total: number;
};

export default function FolderPage() {
  const { folderId } = useParams<{ folderId: string }>();
  const [items, setItems] = useState<Item[] | null>(null);
  const toast = useToast();

  const load = useCallback(() => {
    api<{ items: Item[] }>(`/api/assignments/items?folderId=${folderId}`).then((r) => setItems(r.items)).catch((e) => toast.push('error', e.message));
  }, [folderId, toast]);
  useEffect(load, [load]);
  useEffect(() => onRealtime('assignments', load), [load]);

  if (!items) return <Loading />;

  return (
    <>
      <TopBar title="Assignment contents" />
      <main className="mx-auto max-w-2xl space-y-3 p-4">
        <Link href="/assignments" className="text-sm text-brand-600 hover:underline dark:text-brand-400">← All assignments</Link>
        {items.length === 0 && (
          <Card><EmptyState title="Nothing here yet" subtitle="Subject assignments will appear once added by your Advisor/Representatives." /></Card>
        )}
        {items.map((it) => (
          <Link key={it.id} href={`/assignments/item/${it.id}`}>
            <Card className="flex items-center justify-between p-4 transition hover:border-brand-300">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">{it.subjectName}</p>
                  <Badge tone="brand">{it.subjectCode}</Badge>
                </div>
                <p className="truncate text-xs text-slate-500">{it.title}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {it.deadline ? `Due ${fmtDateTime(it.deadline)} · ` : ''}
                  Submitted {it.submitted}/{it.total}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusPill value={it.myStatus || 'NOT_SUBMITTED'} label={it.myStatus ? it.myStatus === 'SUBMITTED' ? 'Submitted' : 'Not submitted' : 'Not marked'} tone={STATUS_TONE} />
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </div>
            </Card>
          </Link>
        ))}
      </main>
    </>
  );
}
