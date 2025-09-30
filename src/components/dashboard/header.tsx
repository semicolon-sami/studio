'use client';

import Link from 'next/link';
import { Menu, Search, User, Home, PlusSquare, ShoppingCart, FileText, Settings, PackagePlus, Warehouse } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Logo } from '../logo';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ThemeToggle } from '../theme-toggle';
import { useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useRole } from '@/hooks/use-role';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';


const allNavItems = [
  { href: '/dashboard', icon: Home, label: 'Dashboard', adminOnly: true },
  { href: '/dashboard/sales-entry', icon: PlusSquare, label: 'Sales Entry', adminOnly: false },
  { href: '/dashboard/purchase-entry', icon: PackagePlus, label: 'Purchase Entry', adminOnly: true },
  { href: '/dashboard/entries', icon: ShoppingCart, label: 'All Entries', adminOnly: true },
  { href: '/dashboard/inventory', icon: Warehouse, label: 'Inventory', adminOnly: true },
  { href: '/dashboard/reports', icon: FileText, label: 'Reports', adminOnly: true },
  { href: '/dashboard/settings', icon: Settings, label: 'Settings', adminOnly: true },
];


export function DashboardHeader() {
  const userAvatar = PlaceHolderImages.find(img => img.id === 'user-avatar');
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { isAdmin } = useRole();

  const navItems = allNavItems.filter(item => !item.adminOnly || isAdmin);


  const handleLogout = () => {
    auth.signOut().then(() => {
      router.push('/');
    });
  };

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-[60px] lg:px-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0 md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex flex-col">
          <SheetHeader className='border-b mb-4 pb-4'>
            <SheetTitle>
              <Link href="#" className="flex items-center gap-2 text-lg font-semibold" prefetch={false}>
                <Logo className="h-10 w-auto text-primary" />
              </Link>
            </SheetTitle>
          </SheetHeader>
          <nav className="grid gap-2 text-lg font-medium">
            {navItems.map(({ href, icon: Icon, label }) => (
               <Link
                key={href}
                href={href}
                className={cn("mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground", {
                    'bg-muted text-foreground': pathname === href
                })}
                prefetch={false}
              >
                <Icon className='h-5 w-5'/>
                {label}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      <div className="w-full flex-1">
        {isAdmin && (
            <form>
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                type="search"
                placeholder="Search transactions..."
                className="w-full appearance-none bg-background pl-8 shadow-none md:w-2/3 lg:w-1/3"
                />
            </div>
            </form>
        )}
      </div>

      <ThemeToggle />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon" className="rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarImage src={userAvatar?.imageUrl} alt="User avatar" data-ai-hint={userAvatar?.imageHint} />
              <AvatarFallback>
                <User />
              </AvatarFallback>
            </Avatar>
            <span className="sr-only">Toggle user menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>Settings</DropdownMenuItem>
          <DropdownMenuItem>Support</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
