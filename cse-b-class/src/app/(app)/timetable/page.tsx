'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { TopBar } from '@/components/nav';
import { Card, Loading } from '@/components/ui';
import { DEFAULT_CLASSROOM, DAYS, DAY_NAMES, PERIODS } from '@/lib/constants';
import { FlaskConical } from 'lucide-react';

type Slot = {
  id: string;
  dayOfWeek: number;
  period: number;
  isLab: boolean;
  labName: string | null;
  labFloor: string | null;
  subjectName: string | null;
  subjectCode: string | null;
  facultyName: string | null;
};

export default function TimetablePage() {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const today = new Date().getDay();

  useEffect(() => {
    api<{ slots: Slot[] }>('/api/timetable').then((r) => setSlots(r.slots)).catch(() => setSlots([]));
  }, []);

  if (!slots) return <Loading />;
  const at = (d: number, p: number) => slots.find((s) => s.dayOfWeek === d && s.period === p);

  return (
    <>
      <TopBar title="Timetable" />
      <main className="mx-auto max-w-2xl space-y-4 p-4">
        {DAYS.map((d) => (
          <Card key={d} className={today === d ? 'ring-2 ring-brand-500' : ''}>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
              <h2 className="text-sm font-bold">{DAY_NAMES[d]}</h2>
              {today === d && <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">TODAY</span>}
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {PERIODS.map((p) => {
                const s = at(d, p);
                return (
                  <li key={p} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {p}
                    </span>
                    {s ? (
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {s.isLab && <FlaskConical className="mr-1 inline h-3.5 w-3.5 text-violet-500" />}
                          {s.subjectName || 'Free'}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                          {s.isLab ? `Lab: ${s.labName}${s.labFloor ? ` (${s.labFloor})` : ''}` : `${DEFAULT_CLASSROOM}${s.facultyName ? ` · ${s.facultyName}` : ''}`}
                        </p>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-300 dark:text-slate-600">{p === 8 ? 'Free (can be filled when required)' : '—'}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </main>
    </>
  );
}
