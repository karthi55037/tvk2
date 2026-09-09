'use client';

import { useEffect } from 'react';
import { useAuth, registerServiceWorker } from '@/components/providers';
import { BottomNav } from '@/components/nav';
import { Loading } from '@/components/ui';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Wrench } from 'lucide-react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    registerServiceWorker();
  }, []);

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loading label="Loading your class…" />
      </div>
    );
  }

  const isConsole = pathname.startsWith('/console');
  if (isConsole) return <>{children}</>;

  return (
    <div className="min-h-dvh pb-20">
      {user.role === 'ADVISOR' || user.role === 'ADMIN' || user.role === 'REPRESENTATIVE' ? (
        <div className="bg-brand-600 px-4 py-1.5 text-center text-xs font-medium text-white">
          <Link href="/console" className="inline-flex items-center gap-1.5 hover:underline">
            <Wrench className="h-3.5 w-3.5" /> Open management console ({user.role === 'REPRESENTATIVE' ? 'Representative' : user.role})
          </Link>
        </div>
      ) : null}
      {children}
      <BottomNav />
    </div>
  );
}
