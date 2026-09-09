'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { TopBar } from '@/components/nav';
import { Badge, Card, EmptyState, Loading } from '@/components/ui';
import { fmtDateTime } from '@/lib/dates';
import { CalendarClock } from 'lucide-react';

type Meeting = { id: string; message: string; date: string | null; time: string | null; location: string | null; reason: string | null; status: string; createdAt: string };

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);

  useEffect(() => {
    api<{ meetings: Meeting[] }>('/api/meetings').then((r) => setMeetings(r.meetings)).catch(() => setMeetings([]));
  }, []);

  if (!meetings) return <Loading />;

  return (
    <>
      <TopBar title="Advisor Meetings" />
      <main className="mx-auto max-w-2xl space-y-3 p-4">
        {meetings.length === 0 && (
          <Card>
            <EmptyState icon={<CalendarClock className="h-10 w-10" />} title="No meeting requests" subtitle="Private requests from your Class Advisor will appear here." />
          </Card>
        )}
        {meetings.map((m) => (
          <Card key={m.id} className={`space-y-1.5 p-4 ${m.status === 'OPEN' ? 'ring-1 ring-brand-300' : ''}`}>
            <div className="flex items-center justify-between">
              <Badge tone={m.status === 'OPEN' ? 'brand' : 'gray'}>{m.status === 'OPEN' ? 'Please meet' : 'Closed'}</Badge>
              <span className="text-[11px] text-slate-400">{fmtDateTime(m.createdAt)}</span>
            </div>
            <p className="text-sm">{m.message}</p>
            <p className="text-xs text-slate-500">
              {[m.date && `📅 ${m.date}`, m.time && `🕐 ${m.time}`, m.location && `📍 ${m.location}`].filter(Boolean).join(' · ') || ''}
            </p>
            {m.reason && <p className="text-xs italic text-slate-400">{m.reason}</p>}
          </Card>
        ))}
      </main>
    </>
  );
}
