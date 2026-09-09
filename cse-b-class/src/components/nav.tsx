'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { Home, CalendarDays, Activity, BookOpenCheck, MessageSquareText, Menu, Bell } from 'lucide-react';
import { useAuth } from '@/components/providers';

const STUDENT_NAV = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/timetable', label: 'Timetable', icon: CalendarDays },
  { href: '/status', label: 'Status', icon: Activity },
  { href: '/assignments', label: 'Assignments', icon: BookOpenCheck },
  { href: '/chat', label: 'Chat', icon: MessageSquareText },
  { href: '/more', label: 'More', icon: Menu },
];

/** §33 — student navigation: Home, Timetable, Status (right after), Assignments, Chat, More. */
export function BottomNav() {
  const pathname = usePathname();
  const { unread } = useAuth();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} aria-label="Main navigation">
      <div className="mx-auto grid max-w-2xl grid-cols-6">
        {STUDENT_NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors',
                active ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300',
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
              {label}
              {href === '/more' && unread > 0 && (
                <span className="absolute right-[22%] top-1.5 h-2 w-2 rounded-full bg-rose-500" aria-label={`${unread} unread notifications`} />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function TopBar({ title, right }: { title: string; right?: React.ReactNode }) {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">CSE B Class</p>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {right}
          {user && (
            <Link href="/more/notifications" aria-label="Notifications" className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
              <Bell className="h-5 w-5" />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
