
'use client';

import { useState, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { format, startOfTomorrow } from 'date-fns';
import { Calendar as CalendarIcon, Loader2, Upload, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';
import Image from 'next/image';

const formSchema = z.object({
  date: z.date({
    required_error: 'A date is required.',
  }).max(startOfTomorrow(), { message: "Date cannot be in the future." }),
  vendor: z.string().min(1, 'Vendor name is required.'),
  totalKg: z.coerce.number().min(0.01, 'Total Kg must be greater than 0.'),
  totalCost: z.coerce.number().min(1, 'Total purchase cost is required.'),
  transportCost: z.coerce.number().min(0).optional(),
  gst: z.coerce.number().min(0).optional(),
  billPhoto: z.any().refine(file => file instanceof File, { message: 'Bill photo is required.' }),
  sheetWeight18x24: z.coerce.number().min(0.01, 'Weight is required.'),
  sheetWeight24x30: z.coerce.number().min(0.01, 'Weight is required.'),
  sheetWeight30x40: z.coerce.number().min(0.01, 'Weight is required.'),
});

export function PurchaseEntryForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { toast } = useToast();
  const { firestore, user } = useFirebase();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(),
      vendor: '',
      totalKg: 0,
      totalCost: 0,
      transportCost: 0,
      gst: 0,
      sheetWeight18x24: 0,
      sheetWeight24x30: 0,
      sheetWeight30x40: 0,
    },
  });

  const watchAllFields = useWatch({ control: form.control });
  const { totalKg, totalCost, transportCost, gst, sheetWeight18x24, sheetWeight24x30, sheetWeight30x40 } = watchAllFields;

  const avgCostPerKg = useMemo(() => {
    const finalTotalKg = Number(totalKg) || 0;
    const finalTotalCost = (Number(totalCost) || 0) + (Number(transportCost) || 0) + (Number(gst) || 0);
    if (finalTotalKg > 0) {
      return finalTotalCost / finalTotalKg;
    }
    return 0;
  }, [totalKg, totalCost, transportCost, gst]);

  const estimatedSheets = useMemo(() => {
    const finalTotalKg = Number(totalKg) || 0;
    return {
        '18x24': finalTotalKg > 0 && sheetWeight18x24 > 0 ? Math.floor(finalTotalKg / Number(sheetWeight18x24)) : 0,
        '24x30': finalTotalKg > 0 && sheetWeight24x30 > 0 ? Math.floor(finalTotalKg / Number(sheetWeight24x30)) : 0,
        '30x40': finalTotalKg > 0 && sheetWeight30x40 > 0 ? Math.floor(finalTotalKg / Number(sheetWeight30x40)) : 0,
    }
  }, [totalKg, sheetWeight18x24, sheetWeight24x30, sheetWeight30x40]);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      form.setValue('billPhoto', file);
      setImagePreview(URL.createObjectURL(file));
    }
  };
  
  const removeImage = () => {
    form.setValue('billPhoto', null);
    setImagePreview(null);
    const fileInput = document.getElementById('billPhoto') as HTMLInputElement;
    if(fileInput) fileInput.value = '';
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    if (!firestore || !user) {
      toast({ variant: "destructive", title: "Error", description: "Authentication or database error." });
      setIsSubmitting(false);
      return;
    }
    
    try {
        // 1. Upload image to Firebase Storage
        const storage = getStorage();
        const file = values.billPhoto as File;
        const filePath = `purchases/bills/${Date.now()}-${file.name}`;
        const fileRef = storageRef(storage, filePath);
        await uploadBytes(fileRef, file);
        const billPhotoUrl = await getDownloadURL(fileRef);

        // 2. Prepare data for Firestore
        const purchaseData = {
            date: values.date,
            vendor: values.vendor,
            totalKg: values.totalKg,
            totalCost: values.totalCost,
            transportCost: values.transportCost || 0,
            gst: values.gst || 0,
            sheetWeights: {
                '18x24': values.sheetWeight18x24,
                '24x30': values.sheetWeight24x30,
                '30x40': values.sheetWeight30x40,
            },
            estimatedSheets: estimatedSheets,
            avgCostPerKg: avgCostPerKg,
            billPhotoURL: billPhotoUrl,
            createdAt: new Date(),
            createdBy: user.uid
        };

        // 3. Save data to Firestore
        await addDoc(collection(firestore, 'purchases'), purchaseData);

        toast({ title: '✅ Purchase Saved', description: 'The new purchase has been logged successfully.' });
        form.reset();
        setImagePreview(null);
         const fileInput = document.getElementById('billPhoto') as HTMLInputElement;
        if(fileInput) fileInput.value = '';


    } catch (error) {
        console.error("Error saving purchase:", error);
        toast({ variant: "destructive", title: "⚠️ Error", description: "There was a problem saving the purchase." });
    } finally {
        setIsSubmitting(false);
    }
  }
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Purchase Details</CardTitle>
              <CardDescription>Enter the main details of the purchase.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date of Purchase</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={'outline'}
                            className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}
                          >
                            {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date()} initialFocus />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="vendor" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor Name / Source</FormLabel>
                    <FormControl><Input placeholder="e.g., ABC Tarpaulin Co." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
              )} />
              <FormField control={form.control} name="totalKg" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Kg Bought</FormLabel>
                    <FormControl><Input type="number" placeholder="e.g., 1000" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
              )} />
               <FormField control={form.control} name="totalCost" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Purchase Cost (₹)</FormLabel>
                    <FormControl><Input type="number" placeholder="e.g., 140000" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
              )} />
            </CardContent>
          </Card>

          <div className="space-y-8">
             <Card>
                <CardHeader>
                    <CardTitle>Additional Costs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <FormField control={form.control} name="transportCost" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Transport Cost (₹) (Optional)</FormLabel>
                            <FormControl><Input type="number" placeholder="0" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="gst" render={({ field }) => (
                        <FormItem>
                            <FormLabel>GST / Taxes (₹) (Optional)</FormLabel>
                            <FormControl><Input type="number" placeholder="0" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Sheet Weight Mapping</CardTitle>
                    <CardDescription>Enter the weight in Kg for a single sheet of each size.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                     <FormField control={form.control} name="sheetWeight18x24" render={({ field }) => (
                        <FormItem>
                            <FormLabel>18x24</FormLabel>
                            <FormControl><Input type="number" placeholder="e.g. 9" {...field} /></FormControl>
                            <FormDescription className="text-xs">Est. {estimatedSheets['18x24']} sheets</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )} />
                     <FormField control={form.control} name="sheetWeight24x30" render={({ field }) => (
                        <FormItem>
                            <FormLabel>24x30</FormLabel>
                            <FormControl><Input type="number" placeholder="e.g. 12" {...field} /></FormControl>
                             <FormDescription className="text-xs">Est. {estimatedSheets['24x30']} sheets</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )} />
                     <FormField control={form.control} name="sheetWeight30x40" render={({ field }) => (
                        <FormItem>
                            <FormLabel>30x40</FormLabel>
                            <FormControl><Input type="number" placeholder="e.g. 15" {...field} /></FormControl>
                             <FormDescription className="text-xs">Est. {estimatedSheets['30x40']} sheets</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )} />
                </CardContent>
            </Card>
          </div>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>Bill Upload & Cost Calculation</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <FormField
                    control={form.control}
                    name="billPhoto"
                    render={() => (
                        <FormItem>
                        <FormLabel>Bill Photo</FormLabel>
                        <FormControl>
                            <div className="flex items-center justify-center w-full">
                                <label htmlFor="billPhoto" className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-muted hover:bg-muted/80">
                                    {imagePreview ? (
                                        <div className="relative w-full h-full">
                                            <Image src={imagePreview} alt="Bill preview" layout="fill" objectFit="contain" className="rounded-lg" />
                                            <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={(e) => {e.preventDefault(); removeImage();}}>
                                                <XCircle className="h-5 w-5" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                            <Upload className="w-8 h-8 mb-4 text-muted-foreground" />
                                            <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                            <p className="text-xs text-muted-foreground">PNG, JPG, or JPEG</p>
                                        </div>
                                    )}
                                     <Input id="billPhoto" type="file" className="hidden" accept="image/png, image/jpeg" onChange={handleFileChange} />
                                </label>
                            </div>
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="flex flex-col items-center justify-center p-4 bg-muted rounded-lg h-full">
                    <p className="text-lg font-medium text-muted-foreground">Average Cost per Kg</p>
                    <p className="text-4xl font-bold font-headline text-primary">
                        {formatCurrency(avgCostPerKg)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                        (Total Cost + Transport + GST) / Total Kg
                    </p>
                </div>
            </CardContent>
        </Card>

        <Button type="submit" className="w-full text-lg h-12" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Purchase
        </Button>
      </form>
    </Form>
  );
}
