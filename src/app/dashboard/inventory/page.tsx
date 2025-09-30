
'use client';

import { useRole } from '@/hooks/use-role';
import { NotAuthorized } from '@/components/not-authorized';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
                    Live overview of your stock levels and value.
                </p>
            </div>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Feature Under Development</CardTitle>
                <CardDescription>
                    The inventory tracking system requires backend configuration.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p>This page is currently being worked on. The backend needs to be set up with Cloud Functions to aggregate inventory data before this page can be displayed.</p>
                <p className="mt-2 text-sm text-muted-foreground">Once the backend is ready, this page will show real-time stock levels, cost values, and potential profit across all branches.</p>
            </CardContent>
        </Card>
    </div>
  );
}
