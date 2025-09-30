
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm, useWatch, useFieldArray, Controller } from 'react-hook-form';
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
import { Calendar as CalendarIcon, Loader2, Upload, XCircle, PlusCircle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';
import Image from 'next/image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { Purchase } from '@/lib/types';


const stockItemSchema = z.object({
    size: z.string().min(1, 'Size is required.'),
    weightPerSheet: z.coerce.number().min(0.01, 'Weight per sheet is required.'),
    totalWeight: z.coerce.number().min(0.1, 'Total weight is required.'),
    pieces: z.coerce.number().min(1, 'Pieces must be at least 1.'),
});

const formSchema = z.object({
  date: z.date({
    required_error: 'A date is required.',
  }).max(startOfTomorrow(), { message: "Date cannot be in the future." }),
  vendor: z.string().min(1, 'Vendor name is required.'),
  totalCost: z.coerce.number().min(1, 'Total purchase cost is required.'),
  totalWeight: z.coerce.number().min(1, 'Total weight is required.'),
  transportCost: z.coerce.number().min(0).optional(),
  gst: z.coerce.number().min(0).optional(),
  billPhoto: z.any().refine(file => file instanceof File, { message: 'Bill photo is required.' }),
  stock: z.array(stockItemSchema).min(1, 'At least one stock item is required.'),
});

type FormValues = z.infer<typeof formSchema>;

export function PurchaseEntryForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { toast } = useToast();
  const { firestore, user } = useFirebase();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(),
      vendor: '',
      totalCost: 0,
      totalWeight: 0,
      transportCost: 0,
      gst: 0,
      stock: [{ size: '18x24', weightPerSheet: 0, totalWeight: 0, pieces: 0 }],
    },
  });
  
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'stock'
  });
  
  const watchedStock = useWatch({ control: form.control, name: 'stock' });

  useEffect(() => {
    watchedStock.forEach((item, index) => {
        const weightPerSheet = Number(item.weightPerSheet) || 0;
        const totalWeight = Number(item.totalWeight) || 0;
        if (weightPerSheet > 0 && totalWeight > 0) {
            const calculatedPieces = Math.ceil(totalWeight / weightPerSheet);
            const currentPieces = form.getValues(`stock.${index}.pieces`);
            if(calculatedPieces !== currentPieces) {
                 form.setValue(`stock.${index}.pieces`, calculatedPieces, { shouldValidate: true });
            }
        } else {
             const currentPieces = form.getValues(`stock.${index}.pieces`);
             if (currentPieces !== 0) {
                form.setValue(`stock.${index}.pieces`, 0, { shouldValidate: true });
             }
        }
    });
  }, [watchedStock, form]);


  const watchAllFields = useWatch({ control: form.control });
  const { totalCost, transportCost, gst, totalWeight } = watchAllFields;

  const avgCostPerKg = useMemo(() => {
    const finalTotalCost = (Number(totalCost) || 0) + (Number(transportCost) || 0) + (Number(gst) || 0);
    const weight = Number(totalWeight) || 0;
    if (weight > 0) {
      return finalTotalCost / weight;
    }
    return 0;
  }, [totalCost, transportCost, gst, totalWeight]);

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

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true);
    if (!firestore || !user) {
      toast({ variant: "destructive", title: "Error", description: "Authentication or database error." });
      setIsSubmitting(false);
      return;
    }
    
    try {
        const storage = getStorage();
        const file = values.billPhoto as File;
        const filePath = `purchases/bills/${Date.now()}-${file.name}`;
        const fileRef = storageRef(storage, filePath);
        await uploadBytes(fileRef, file);
        const billPhotoUrl = await getDownloadURL(fileRef);

        const purchaseData: Omit<Purchase, 'id'> = {
            date: values.date,
            vendor: values.vendor,
            totalCost: values.totalCost,
            transportCost: values.transportCost || 0,
            gst: values.gst || 0,
            stock: values.stock.map(s => ({
                size: s.size,
                pieces: s.pieces,
                weight: s.totalWeight, // Map totalWeight to weight
            })),
            totalKg: values.totalWeight,
            avgCostPerKg: avgCostPerKg,
            billPhotoURL: billPhotoUrl,
            createdAt: new Date(),
            createdBy: user.uid
        };

        await addDoc(collection(firestore, 'purchases'), purchaseData);

        toast({ title: '✅ Purchase Saved', description: 'The new purchase has been logged successfully.' });
        form.reset();
        remove(); // This will clear all stock items
        append({ size: '18x24', weightPerSheet: 0, totalWeight: 0, pieces: 0 }); // Add a fresh one
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-8">
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
                <FormField control={form.control} name="totalCost" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Total Purchase Cost (₹)</FormLabel>
                        <FormControl><Input type="number" placeholder="e.g., 140000" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="totalWeight" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Total Weight (Kg)</FormLabel>
                        <FormControl><Input type="number" placeholder="e.g., 1000" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Additional Costs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <FormField control={form.control} name="transportCost" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Transport Cost (₹) (Optional)</FormLabel>
                            <FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="gst" render={({ field }) => (
                        <FormItem>
                            <FormLabel>GST / Taxes (₹) (Optional)</FormLabel>
                            <FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card>
                <CardHeader>
                    <CardTitle>Stock Details</CardTitle>
                    <CardDescription>Enter the weight for each tarpaulin size to auto-calculate pieces.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {fields.map((item, index) => (
                         <div key={item.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-end p-4 border rounded-lg">
                            <FormField
                                control={form.control}
                                name={`stock.${index}.size`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Size</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a size" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="18x24">18 x 24</SelectItem>
                                                <SelectItem value="24x30">24 x 30</SelectItem>
                                                <SelectItem value="30x40">30 x 40</SelectItem>
                                                <SelectItem value="other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name={`stock.${index}.weightPerSheet`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Wt. per Sheet (Kg)</FormLabel>
                                        <FormControl><Input type="number" step="0.01" placeholder="e.g., 8.5" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name={`stock.${index}.totalWeight`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Total Weight (Kg)</FormLabel>
                                        <FormControl><Input type="number" step="0.1" placeholder="e.g., 450" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name={`stock.${index}.pieces`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>No. of Pieces</FormLabel>
                                        <FormControl><Input type="number" {...field} readOnly className="bg-muted" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                         </div>
                    ))}
                     <Button type="button" variant="outline" size="sm" onClick={() => append({ size: '18x24', weightPerSheet: 0, totalWeight: 0, pieces: 0 })}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Another Size
                    </Button>
                    {form.formState.errors.stock && (
                        <p className="text-sm font-medium text-destructive">{form.formState.errors.stock.message}</p>
                    )}
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
                     <p className="text-sm font-medium text-muted-foreground mt-4">Total Weight</p>
                    <p className="text-2xl font-bold text-primary">
                        {Number(totalWeight).toFixed(2)} Kg
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                        Based on purchase details entered
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
