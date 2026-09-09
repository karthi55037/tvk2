'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import { Card, Loading } from '@/components/ui';
import { useAuth } from '@/components/providers';
import { BookOpenCheck, ClipboardList, FlaskConical, FileText, Landmark, ShieldAlert, Users, DoorOpen } from 'lucide-react';

type Overview = {
  students: number;
  representatives: number;
  pendingLeaves: number;
  pendingODs: number;
  outNow: number;
  activeFolders: number;
  pendingResources: number;
  openReports: number;
  pendingRecords: number;
  todayStatusMarks: number;
};

export default function ConsoleHome() {
  const { user } = useAuth();
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    api<Overview>('/api/console/overview').then(setData).catch(() => void 0);
  }, []);

  if (!data) return <Loading />;

  const cards = [
    { label: 'Students', value: data.students, icon: Users, href: '/console/students' },
    { label: 'Out of class now', value: data.outNow, icon: DoorOpen, href: '/status' },
    { label: 'Pending leaves', value: data.pendingLeaves, icon: FileText, href: '/console/leave' },
    { label: 'Pending ODs', value: data.pendingODs, icon: Landmark, href: '/console/od' },
    { label: 'Resources to verify', value: data.pendingResources, icon: ClipboardList, href: '/console/assignments' },
    { label: 'Records to verify', value: data.pendingRecords, icon: FlaskConical, href: '/console/experiments' },
    { label: 'Open reports', value: data.openReports, icon: ShieldAlert, href: '/console/moderation' },
    { label: 'Active assignment sets', value: data.activeFolders, icon: BookOpenCheck, href: '/console/assignments' },
    { label: 'Status marked today', value: data.todayStatusMarks, icon: Users, href: '/console/students' },
  ].filter((c) => user?.role !== 'REPRESENTATIVE' || !['Pending leaves', 'Pending ODs'].includes(c.label));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-sm text-slate-400">Class management at a glance — {new Date().toDateString()}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href}>
            <Card className="p-4 transition hover:border-brand-300">
              <Icon className="mb-2 h-5 w-5 text-brand-600 dark:text-brand-400" />
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-slate-400">{label}</p>
            </Card>
          </Link>
        ))}
      </div>
      <Card className="p-4">
        <h2 className="text-sm font-semibold">Quick links</h2>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          <Link className="rounded-xl bg-brand-50 px-3 py-2 font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-400" href="/console/students">Import students (Excel)</Link>
          <Link className="rounded-xl bg-brand-50 px-3 py-2 font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-400" href="/console/subjects">Manage subjects</Link>
          <Link className="rounded-xl bg-brand-50 px-3 py-2 font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-400" href="/console/timetable">Edit timetable</Link>
          <Link className="rounded-xl bg-brand-50 px-3 py-2 font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-400" href="/console/announcements">Post announcement</Link>
        </div>
      </Card>
    </div>
  );
}
