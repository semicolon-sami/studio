'use client';

import { useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Purchase, SalesEntry } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Helper to format currency
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
};

export function InventoryTable() {
    const { firestore } = useFirebase();

    // Fetch all purchases and sales entries
    const purchasesRef = useMemoFirebase(() => firestore ? collection(firestore, 'purchases') : null, [firestore]);
    const salesEntriesRef = useMemoFirebase(() => firestore ? collection(firestore, 'sales_entries') : null, [firestore]);

    const { data: purchases, isLoading: isLoadingPurchases } = useCollection<Purchase>(purchasesRef);
    const { data: sales, isLoading: isLoadingSales } = useCollection<SalesEntry>(salesEntriesRef);

    const inventoryData = useMemo(() => {
        if (!purchases || !sales) return null;

        const stock = new Map<string, { pieces: number; totalWeight: number; avgCostPerKg: number }>();
        const salesData = new Map<string, number>();

        // 1. Aggregate all purchases
        purchases.forEach(purchase => {
            purchase.stock.forEach(item => {
                const key = item.size;
                const existing = stock.get(key) || { pieces: 0, totalWeight: 0, avgCostPerKg: 0 };
                
                const newTotalPieces = existing.pieces + item.pieces;
                const newTotalWeight = existing.totalWeight + item.weight;

                // Calculate weighted average cost
                const newAvgCost = ((existing.avgCostPerKg * existing.totalWeight) + (purchase.avgCostPerKg * item.weight)) / newTotalWeight;

                stock.set(key, {
                    pieces: newTotalPieces,
                    totalWeight: newTotalWeight,
                    avgCostPerKg: newAvgCost,
                });
            });
        });
        
        // 2. Aggregate all sales
        sales.forEach(sale => {
            const key = sale.size;
            salesData.set(key, (salesData.get(key) || 0) + sale.pieces);
        });

        // 3. Calculate remaining inventory
        const inventory: any[] = [];
        let totalCostValue = 0;
        let totalEstimatedProfit = 0;

        stock.forEach((data, size) => {
            const piecesSold = salesData.get(size) || 0;
            const remainingPieces = data.pieces - piecesSold;
            
            if (remainingPieces > 0) {
                const avgWeightPerPiece = data.totalWeight / data.pieces;
                const remainingWeight = remainingPieces * avgWeightPerPiece;
                const costOfRemaining = remainingWeight * data.avgCostPerKg;

                // Estimate profit based on average sale price (very simplified)
                const salesForThisSize = sales.filter(s => s.size === size);
                const totalAmountSold = salesForThisSize.reduce((sum, s) => sum + s.amount, 0);
                const totalPiecesSoldForAvg = salesForThisSize.reduce((sum, s) => sum + s.pieces, 0);
                const avgSalePricePerPiece = totalPiecesSoldForAvg > 0 ? totalAmountSold / totalPiecesSoldForAvg : 0;
                
                const costPerPiece = avgWeightPerPiece * data.avgCostPerKg;
                const estimatedProfitPerPiece = avgSalePricePerPiece > 0 ? avgSalePricePerPiece - costPerPiece : 0;
                const estimatedProfit = remainingPieces * estimatedProfitPerPiece;

                totalCostValue += costOfRemaining;
                if (estimatedProfit > 0) {
                    totalEstimatedProfit += estimatedProfit;
                }

                inventory.push({
                    size,
                    remainingPieces,
                    remainingWeight: remainingWeight.toFixed(2),
                    costOfRemaining,
                    estimatedProfit: estimatedProfit > 0 ? estimatedProfit : 0,
                });
            }
        });

        return { inventory, totalCostValue, totalEstimatedProfit };

    }, [purchases, sales]);


    const isLoading = isLoadingPurchases || isLoadingSales;

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-48 mb-2" />
                    <Skeleton className="h-4 w-72" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-48 w-full" />
                    </div>
                </CardContent>
            </Card>
        );
    }
    
    if (!inventoryData) {
        return <p>No inventory data available. Start by adding purchases and sales.</p>
    }

    return (
        <Tabs defaultValue="summary">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="summary">Inventory Summary</TabsTrigger>
                <TabsTrigger value="branches" disabled>Branch View (Coming Soon)</TabsTrigger>
            </TabsList>
            <TabsContent value="summary">
                 <Card>
                    <CardHeader>
                        <CardTitle>Overall Stock Summary</CardTitle>
                        <CardDescription>
                            This table shows the remaining stock levels across all branches, their estimated cost value, and potential profit.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Size</TableHead>
                                    <TableHead className="text-right">Remaining Pieces</TableHead>
                                    <TableHead className="text-right">Remaining Weight (Kg)</TableHead>
                                    <TableHead className="text-right">Est. Cost Value</TableHead>
                                    <TableHead className="text-right">Est. Potential Profit</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {inventoryData.inventory.map((item) => (
                                    <TableRow key={item.size}>
                                        <TableCell className="font-medium">{item.size}</TableCell>
                                        <TableCell className="text-right">{item.remainingPieces}</TableCell>
                                        <TableCell className="text-right">{item.remainingWeight}</TableCell>
                                        <TableCell className="text-right text-orange-600">{formatCurrency(item.costOfRemaining)}</TableCell>
                                        <TableCell className="text-right text-green-600">{formatCurrency(item.estimatedProfit)}</TableCell>
                                    </TableRow>
                                ))}
                                {inventoryData.inventory.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center h-24">
                                            No stock remaining.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                             <TableFooter>
                                <TableRow className="bg-muted/50 font-bold">
                                    <TableCell colSpan={3}>Totals</TableCell>
                                    <TableCell className="text-right">{formatCurrency(inventoryData.totalCostValue)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(inventoryData.totalEstimatedProfit)}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
       
    );
}
