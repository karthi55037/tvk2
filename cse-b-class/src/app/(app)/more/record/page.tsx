'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import { TopBar } from '@/components/nav';
import { Badge, Card, EmptyState, Loading } from '@/components/ui';
import { ChevronRight, FlaskConical } from 'lucide-react';

type Subject = { id: string; name: string; code: string; experiments: { id: string; number: number; name: string }[] };

export default function RecordPage() {
  const [subjects, setSubjects] = useState<Subject[] | null>(null);

  useEffect(() => {
    api<{ subjects: Subject[] }>('/api/experiments').then((r) => setSubjects(r.subjects)).catch(() => setSubjects([]));
  }, []);

  if (!subjects) return <Loading />;
  const withExp = subjects.filter((s) => s.experiments.length > 0);

  return (
    <>
      <TopBar title="Record & Observation" />
      <main className="mx-auto max-w-2xl space-y-4 p-4">
        {withExp.length === 0 && (
          <Card>
            <EmptyState icon={<FlaskConical className="h-10 w-10" />} title="No experiments yet" subtitle="Experiments are organized by subject. Your Advisor/Representatives will add them." />
          </Card>
        )}
        {withExp.map((s) => (
          <Card key={s.id} className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <h2 className="font-semibold">{s.name}</h2>
              <Badge tone="brand">{s.code}</Badge>
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {s.experiments.map((e) => (
                <li key={e.id}>
                  <Link href={`/more/record/${e.id}`} className="flex items-center justify-between py-2.5">
                    <p className="text-sm">
                      <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-violet-50 text-xs font-bold text-violet-600 dark:bg-violet-500/10 dark:text-violet-400">
                        {e.number}
                      </span>
                      {e.name}
                    </p>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ))}
        <p className="pb-2 text-center text-[11px] text-slate-400">Subject → Experiments. Each experiment has its own upload, verification and chat — separate from assignments.</p>
      </main>
    </>
  );
}
