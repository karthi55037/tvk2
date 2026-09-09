'use client';

import Link from 'next/link';
import { TopBar } from '@/components/nav';
import { Card } from '@/components/ui';
import { useAuth } from '@/components/providers';
import { ThemeToggle } from '@/components/providers';
import {
  User, Users, FileText, Landmark, FlaskConical, Bell, CarFront, CalendarClock, Archive, ShieldCheck, LogOut, Settings,
} from 'lucide-react';

const LINKS = [
  { href: '/more/profile', label: 'My Profile', icon: User, desc: 'View and edit your information' },
  { href: '/more/students', label: 'Class Directory', icon: Users, desc: 'Permitted info of classmates' },
  { href: '/more/leave', label: 'Leave', icon: FileText, desc: 'Request, letters, status' },
  { href: '/more/od', label: 'OD', icon: Landmark, desc: 'On-duty requests & letters' },
  { href: '/more/record', label: 'Record & Observation', icon: FlaskConical, desc: 'Experiments by subject' },
  { href: '/more/visits', label: 'Teacher Visits', icon: CarFront, desc: 'Visit records about you' },
  { href: '/more/meetings', label: 'Advisor Meetings', icon: CalendarClock, desc: 'Private meeting requests' },
  { href: '/more/completed', label: 'Completed Assignments', icon: Archive, desc: 'Archived history' },
  { href: '/more/notifications', label: 'Notification Settings', icon: Bell, desc: 'Choose what pings you' },
];

export default function MorePage() {
  const { user, logout } = useAuth();

  return (
    <>
      <TopBar title="More" />
      <main className="mx-auto max-w-2xl space-y-4 p-4">
        <div className="grid grid-cols-2 gap-2.5">
          {LINKS.map(({ href, label, icon: Icon, desc }) => (
            <Link key={href} href={href}>
              <Card className="h-full p-3.5 transition hover:border-brand-300">
                <Icon className="mb-2 h-5 w-5 text-brand-600 dark:text-brand-400" />
                <p className="text-sm font-semibold">{label}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{desc}</p>
              </Card>
            </Link>
          ))}
        </div>

        {(user?.role === 'ADVISOR' || user?.role === 'ADMIN' || user?.role === 'REPRESENTATIVE') && (
          <Link href="/console">
            <Card className="flex items-center gap-3 p-4">
              <Settings className="h-5 w-5 text-brand-600" />
              <div>
                <p className="text-sm font-semibold">Management Console</p>
                <p className="text-xs text-slate-400">Role tools — students, roles, moderation, verification</p>
              </div>
            </Card>
          </Link>
        )}

        <Card className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="text-sm font-semibold">Appearance</p>
              <p className="text-xs text-slate-400">Light / dark theme</p>
            </div>
          </div>
          <ThemeToggle className="rounded-xl border border-slate-200 p-2 text-lg dark:border-slate-700" />
        </Card>

        <button onClick={() => void logout()} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-sm font-semibold text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
        <p className="pb-2 text-center text-[11px] text-slate-400">CSE B Class · v1.0</p>
      </main>
    </>
  );
}
