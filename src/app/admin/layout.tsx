'use client';

import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  ArrowLeft,
  LayoutDashboard,
  LifeBuoy,
  ListOrdered,
  Settings,
  Users,
} from 'lucide-react';
import { useAdminGuard } from '@/hooks/use-admin';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/customers', label: 'Clientes', icon: Users },
  { href: '/admin/transactions', label: 'Transações', icon: ListOrdered },
  { href: '/admin/strategies', label: 'Estratégias', icon: Settings },
  { href: '/admin/support', label: 'Suporte', icon: LifeBuoy },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { ready, authenticated } = usePrivy();
  const { isAdmin, role, isLoading } = useAdminGuard();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && !authenticated) router.replace('/');
  }, [ready, authenticated, router]);

  useEffect(() => {
    if (!isLoading && !isAdmin && ready && authenticated) router.replace('/app');
  }, [isAdmin, isLoading, ready, authenticated, router]);

  if (!ready || !authenticated || isLoading || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-300">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 animate-pulse rounded-full bg-brand-400" />
          Verificando permissões...
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 flex-shrink-0 border-r border-white/5 bg-ink-900/60 p-4 md:flex md:flex-col">
        <Link href="/app" className="mb-6 flex items-center gap-2 text-sm text-ink-300 hover:text-ink-50">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao app
        </Link>

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-brand font-display font-bold text-white shadow-glow">
            P
          </div>
          <div>
            <p className="font-display text-sm font-bold text-ink-50">PoupApp</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-300">
              Admin · {role}
            </p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== '/admin' && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? 'bg-brand-500/15 text-brand-200 ring-1 ring-brand-500/30'
                    : 'text-ink-300 hover:bg-ink-800 hover:text-ink-50'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <div className="md:hidden sticky top-0 z-10 flex items-center gap-3 border-b border-white/5 bg-ink-900/80 px-4 py-3 backdrop-blur">
          <Link href="/app" className="text-ink-300">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <p className="font-display text-sm font-bold">Admin</p>
        </div>
        {children}
      </main>
    </div>
  );
}
