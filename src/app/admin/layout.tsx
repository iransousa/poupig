'use client';

import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  ArrowLeft,
  DollarSign,
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
  { href: '/admin/finance', label: 'Finance', icon: DollarSign },
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
      <div className="flex min-h-screen items-center justify-center text-fg-mid">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          Verificando permissões...
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 flex-shrink-0 border-r border-line bg-bg-1 p-4 md:flex md:flex-col">
        <Link
          href="/app"
          className="mb-6 flex items-center gap-2 text-[13px] text-fg-mid hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao app
        </Link>

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-accent font-display font-bold text-bg-0 shadow-accent">
            P
          </div>
          <div>
            <p className="font-display text-[13px] font-bold text-fg">PoupApp</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">
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
                className={`flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-[13px] font-medium transition ${
                  active
                    ? 'bg-accent-soft text-accent ring-1 ring-accent/30'
                    : 'text-fg-mid hover:bg-bg-2 hover:text-fg'
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
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-bg-1/80 px-4 py-3 backdrop-blur md:hidden">
          <Link href="/app" className="text-fg-mid">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <p className="font-display text-[13px] font-bold">Admin</p>
        </div>
        {children}
      </main>
    </div>
  );
}
