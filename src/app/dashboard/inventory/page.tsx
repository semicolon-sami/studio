'use client';

import { useRole } from '@/hooks/use-role';
import { NotAuthorized } from '@/components/not-authorized';
import { Skeleton } from '@/components/ui/skeleton';
import { InventoryTable } from '@/components/inventory/inventory-table';
import { Warehouse } from 'lucide-react';

export default function InventoryPage() {
  const { isAdmin, isLoading } = useRole();

  if (isLoading) {
    return (
      <div className="container mx-auto py-10 space-y-8">
        <div className="flex items-center gap-4 mb-6">
            <Skeleton className="h-10 w-10" />
            <div>
                <Skeleton className="h-9 w-64 mb-2" />
                <Skeleton className="h-5 w-80" />
            </div>
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return <NotAuthorized />;
  }

  return (
    <div className="container mx-auto py-6 md:py-10">
       <div className="flex-1 mb-6 flex items-center gap-4">
            <Warehouse className="h-8 w-8 text-primary" />
            <div>
                <h1 className="text-2xl md:text-3xl font-bold font-headline">Inventory Tracking</h1>
                <p className="text-sm md:text-base text-muted-foreground">
                    Live overview of your stock levels and value across all branches.
                </p>
            </div>
        </div>
      <InventoryTable />
    </div>
  );
}
