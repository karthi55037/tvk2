'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers';
import { Loading } from '@/components/ui';
import { ThemeToggle } from '@/components/providers';
import { clsx } from 'clsx';
import {
  LayoutDashboard, Users, UserCog, BookMarked, CalendarRange, FileText, Landmark, BookOpenCheck,
  FlaskConical, Megaphone, ShieldAlert, ScrollText, CarFront, Settings as SettingsIcon, ArrowLeft,
} from 'lucide-react';

const NAV = [
  { href: '/console', label: 'Overview', icon: LayoutDashboard, roles: ['ADVISOR', 'REPRESENTATIVE', 'ADMIN'] },
  { href: '/console/students', label: 'Students', icon: Users, roles: ['ADVISOR', 'ADMIN'] },
  { href: '/console/roles', label: 'Roles', icon: UserCog, roles: ['ADVISOR', 'REPRESENTATIVE', 'ADMIN'] },
  { href: '/console/subjects', label: 'Subjects', icon: BookMarked, roles: ['ADVISOR', 'REPRESENTATIVE', 'ADMIN'] },
  { href: '/console/timetable', label: 'Timetable', icon: CalendarRange, roles: ['ADVISOR', 'REPRESENTATIVE', 'ADMIN'] },
  { href: '/console/assignments', label: 'Assignments', icon: BookOpenCheck, roles: ['ADVISOR', 'REPRESENTATIVE', 'ADMIN'] },
  { href: '/console/experiments', label: 'Record & Obs.', icon: FlaskConical, roles: ['ADVISOR', 'REPRESENTATIVE', 'ADMIN'] },
  { href: '/console/leave', label: 'Leave', icon: FileText, roles: ['ADVISOR', 'ADMIN'] },
  { href: '/console/od', label: 'OD', icon: Landmark, roles: ['ADVISOR', 'ADMIN'] },
  { href: '/console/announcements', label: 'Announcements', icon: Megaphone, roles: ['ADVISOR', 'REPRESENTATIVE', 'ADMIN'] },
  { href: '/console/visits', label: 'Visits', icon: CarFront, roles: ['ADVISOR', 'REPRESENTATIVE', 'ADMIN'] },
  { href: '/console/moderation', label: 'Moderation', icon: ShieldAlert, roles: ['ADVISOR', 'REPRESENTATIVE', 'ADMIN'] },
  { href: '/console/audit', label: 'Audit Logs', icon: ScrollText, roles: ['ADVISOR', 'ADMIN'] },
  { href: '/console/settings', label: 'Settings', icon: SettingsIcon, roles: ['ADMIN'] },
];

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();

  if (loading) return <Loading />;
  if (!user) return <Loading label="Redirecting to sign-in…" />;
  if (user.role === 'STUDENT') {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6 text-center">
        <div>
          <p className="text-lg font-semibold">The management console is for class staff.</p>
          <Link href="/home" className="mt-3 inline-block rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white">Go to my class app</Link>
        </div>
      </div>
    );
  }

  const items = NAV.filter((n) => n.roles.includes(user.role));

  return (
    <div className="flex min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex">
        <div className="border-b border-slate-100 p-4 dark:border-slate-800">
          <p className="text-sm font-bold text-brand-700 dark:text-brand-400">CSE B · Console</p>
          <p className="mt-0.5 text-xs text-slate-400">{user.name} · {user.role}</p>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3" aria-label="Console">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition',
                  active ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800',
                )}
              >
                <Icon className="h-4 w-4" /> {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-100 p-3 dark:border-slate-800">
          <Link href="/home" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800">
            <ArrowLeft className="h-4 w-4" /> Class app
          </Link>
          <button onClick={() => void logout()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10">
            Sign out
          </button>
          <div className="flex justify-center py-1"><ThemeToggle className="rounded-lg border border-slate-200 p-1.5 dark:border-slate-700" /></div>
        </div>
      </aside>
      <div className="lg:pl-60">
        <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900 lg:hidden">
          {items.map(({ href, label }) => (
            <Link key={href} href={href} className={clsx('whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium', pathname === href ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>
              {label}
            </Link>
          ))}
        </div>
        <main className="mx-auto max-w-6xl p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
