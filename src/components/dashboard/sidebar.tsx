'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  ShoppingCart,
  FileText,
  Settings,
  PlusSquare,
  PackagePlus,
  Warehouse,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Logo } from '../logo';
import { useRole } from '@/hooks/use-role';


const allNavItems = [
  { href: '/dashboard', icon: Home, label: 'Dashboard', adminOnly: true },
  { href: '/dashboard/sales-entry', icon: PlusSquare, label: 'Sales Entry', adminOnly: false },
  { href: '/dashboard/purchase-entry', icon: PackagePlus, label: 'Purchase Entry', adminOnly: true },
  { href: '/dashboard/entries', icon: ShoppingCart, label: 'All Entries', adminOnly: true },
  { href: '/dashboard/inventory', icon: Warehouse, label: 'Inventory', adminOnly: true },
  { href: '/dashboard/reports', icon: FileText, label: 'Reports', adminOnly: true },
  { href: '/dashboard/settings', icon: Settings, label: 'Settings', adminOnly: true },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const { isAdmin } = useRole();

  const navItems = allNavItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <div className="hidden border-r bg-background md:block">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold" prefetch={false}>
            <Logo className="h-8 w-auto text-primary" />
          </Link>
        </div>
        <div className="flex-1">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            {navItems.map(({ href, icon: Icon, label, adminOnly }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
                  { 'bg-muted text-primary': pathname === href }
                )}
                prefetch={false}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-auto p-4">
          <Card x-chunk="dashboard-02-chunk-0">
            <CardHeader className="p-2 pt-0 md:p-4">
              <CardTitle>Need Help?</CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-0 md:p-4 md:pt-0">
              <p className="text-xs text-muted-foreground mb-4">
                Our guide provides audio instructions for all features.
              </p>
              <Button size="sm" className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                Play Audio Guide
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
