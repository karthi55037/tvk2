'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, onRealtime } from '@/lib/client';
import { useAuth } from '@/components/providers';
import { TopBar } from '@/components/nav';
import { Badge, Card, Loading, StatusPill, useToast } from '@/components/ui';
import { DEFAULT_CLASSROOM } from '@/lib/constants';
import { DAILY_STATUS_LABEL } from '@/lib/format';
import { LEAVE_STATUS_LABEL, OD_STATUS_LABEL } from '@/lib/format';
import { STATUS_TONE } from '@/lib/format';
import { Megaphone, BookOpenCheck, Users, MessageSquareText, ClipboardList, ArrowRight, MapPin } from 'lucide-react';
import { fmtDateTime, fmtTime } from '@/lib/dates';

type Dash = {
  profile: { name: string; regNo: string | null };
  timetable: { period: number; isLab: boolean; labName: string | null; labFloor: string | null; subjectName: string | null; subjectCode: string | null }[];
  todayStatus: { status: string; halfDayPart: string | null } | null;
  announcements: { id: string; title: string; message: string; createdAt: string; read: boolean }[];
  pendingAssignments: { id: string; title: string; deadline: string | null; subjectName: string; folderNumber: number }[];
  outNow: { id: string; name: string; destination: string; outAt: string; expectedReturnAt: string }[];
  chatActivity: { id: string; body: string | null; createdAt: string; userName: string }[];
  leaveStatus: { id: string; status: string; fromDate: string; toDate: string }[];
  odStatus: { id: string; status: string; date: string; programName: string }[];
  myOutOfClass: { id: string; destination: string; outAt: string; expectedReturnAt: string } | null;
};

export default function HomePage() {
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<Dash | null>(null);

  const load = useCallback(() => {
    api<Dash>('/api/dashboard').then(setData).catch((e) => toast.push('error', e.message));
  }, [toast]);
  useEffect(load, [load]);
  useEffect(() => onRealtime('assignments', load), [load]);

  if (!data) return <Loading />;

  return (
    <>
      <TopBar title={`Hi, ${data.profile.name.split(' ')[0]} 👋`} />
      <main className="mx-auto max-w-2xl space-y-4 p-4">
        {/* 1. profile */}
        <Card className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{data.profile.name}</p>
            <p className="text-xs text-slate-500">{data.profile.regNo ?? user?.username} · CSE B</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">
            {data.profile.name.charAt(0)}
          </div>
        </Card>

        {/* 3. today's class status + my out-of-class */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Today&apos;s status</h2>
            {data.todayStatus ? (
              <StatusPill value={data.todayStatus.status} label={DAILY_STATUS_LABEL[data.todayStatus.status]} tone={STATUS_TONE} />
            ) : (
              <Badge tone="gray">Not set</Badge>
            )}
          </div>
          {data.myOutOfClass && (
            <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-500/10">
              <p className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                <MapPin className="h-4 w-4" /> You are out — {data.myOutOfClass.destination}
              </p>
              <p className="mt-0.5 text-xs text-amber-600/80 dark:text-amber-400/70">
                Since {fmtTime(data.myOutOfClass.outAt)} · expected back {fmtTime(data.myOutOfClass.expectedReturnAt)}
              </p>
              <Link href="/status" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 underline dark:text-amber-400">
                Manage <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          )}
          <Link href="/status" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400">
            Update status <ArrowRight className="h-3 w-3" />
          </Link>
        </Card>

        {/* 2. today's timetable */}
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Today&apos;s timetable</h2>
            <Link href="/timetable" className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400">Full week</Link>
          </div>
          {data.timetable.length === 0 ? (
            <p className="py-3 text-center text-sm text-slate-400">No classes scheduled today.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.timetable.map((s) => (
                <li key={s.period} className="flex items-center gap-3 py-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
                    {s.period}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.isLab ? `Lab — ${s.subjectName || 'Free'}` : s.subjectName || 'Free period'}</p>
                    <p className="truncate text-xs text-slate-400">{s.isLab ? `${s.labName}${s.labFloor ? ` · ${s.labFloor}` : ''}` : DEFAULT_CLASSROOM}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* 4. latest announcements */}
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Megaphone className="h-4 w-4 text-brand-600" /> Announcements</h2>
            <Link href="/more" className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400">All</Link>
          </div>
          {data.announcements.length === 0 ? (
            <p className="py-3 text-center text-sm text-slate-400">No announcements yet.</p>
          ) : (
            <ul className="space-y-2">
              {data.announcements.map((a) => (
                <li key={a.id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {!a.read && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-label="new" />}
                    {a.title}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{a.message}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{fmtDateTime(a.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* 5. pending assignments */}
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold"><BookOpenCheck className="h-4 w-4 text-brand-600" /> Pending assignments</h2>
            <Link href="/assignments" className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400">All</Link>
          </div>
          {data.pendingAssignments.length === 0 ? (
            <p className="py-3 text-center text-sm text-slate-400">You&apos;re all caught up 🎉</p>
          ) : (
            <ul className="space-y-2">
              {data.pendingAssignments.map((a) => (
                <li key={a.id}>
                  <Link href={`/assignments/item/${a.id}`} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800">
                    <div>
                      <p className="text-sm font-medium">{a.subjectName} — A{a.folderNumber}</p>
                      <p className="text-xs text-slate-500">{a.title}{a.deadline ? ` · due ${fmtDateTime(a.deadline)}` : ''}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* 6. current out-of-class students */}
        <Card className="p-4">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Users className="h-4 w-4 text-brand-600" /> Out of class now</h2>
          {data.outNow.length === 0 ? (
            <p className="py-3 text-center text-sm text-slate-400">Everyone is in class.</p>
          ) : (
            <ul className="space-y-2">
              {data.outNow.map((o) => (
                <li key={o.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                  <span className="text-sm font-medium">{o.name}</span>
                  <span className="text-xs text-slate-500">{o.destination} · back by {fmtTime(o.expectedReturnAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* 7. latest class chat activity */}
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold"><MessageSquareText className="h-4 w-4 text-brand-600" /> Class chat</h2>
            <Link href="/chat" className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400">Open</Link>
          </div>
          {data.chatActivity.length === 0 ? (
            <p className="py-3 text-center text-sm text-slate-400">No messages yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {data.chatActivity.map((m) => (
                <li key={m.id} className="text-sm">
                  <span className="font-medium">{m.userName}:</span>{' '}
                  <span className="text-slate-600 dark:text-slate-300">{m.body || '📎 file'}</span>
                  <span className="ml-1 text-[11px] text-slate-400">{fmtTime(m.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* 8. leave / OD status */}
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold"><ClipboardList className="h-4 w-4 text-brand-600" /> Leave & OD</h2>
            <Link href="/more/leave" className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400">Manage</Link>
          </div>
          {data.leaveStatus.length === 0 && data.odStatus.length === 0 ? (
            <p className="py-3 text-center text-sm text-slate-400">No requests yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {data.leaveStatus.map((l) => (
                <li key={l.id} className="flex items-center justify-between text-sm">
                  <span>Leave · {l.fromDate}</span>
                  <StatusPill value={l.status} label={LEAVE_STATUS_LABEL[l.status]} tone={STATUS_TONE} />
                </li>
              ))}
              {data.odStatus.map((o) => (
                <li key={o.id} className="flex items-center justify-between text-sm">
                  <span>OD · {o.programName.slice(0, 24)}</span>
                  <StatusPill value={o.status} label={OD_STATUS_LABEL[o.status]} tone={STATUS_TONE} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </>
  );
}
