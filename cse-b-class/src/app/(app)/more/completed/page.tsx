'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import { TopBar } from '@/components/nav';
import { Badge, Card, EmptyState, Loading } from '@/components/ui';
import { Archive, ChevronRight } from 'lucide-react';

type Folder = { id: string; number: number; status: string; itemCount: number; completedAt: string | null };

export default function CompletedPage() {
  const [folders, setFolders] = useState<Folder[] | null>(null);

  useEffect(() => {
    api<{ folders: Folder[] }>('/api/assignments/folders')
      .then((r) => setFolders(r.folders.filter((f) => f.status === 'COMPLETED')))
      .catch(() => setFolders([]));
  }, []);

  if (!folders) return <Loading />;

  return (
    <>
      <TopBar title="Completed Assignments" />
      <main className="mx-auto max-w-2xl space-y-3 p-4">
        {folders.length === 0 ? (
          <Card><EmptyState icon={<Archive className="h-10 w-10" />} title="No completed assignments yet" subtitle="Assignments move here when closed — records are retained." /></Card>
        ) : (
          folders.map((f) => (
            <Link key={f.id} href={`/assignments/${f.id}`}>
              <Card className="flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold">Assignment {f.number}</p>
                  <p className="text-xs text-slate-500">{f.itemCount} subjects · history retained</p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </Card>
            </Link>
          ))
        )}
      </main>
    </>
  );
}
