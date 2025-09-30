
export type Transaction = {
  id: string;
  amount: number;
  type: "sale" | "expense" | "purchase";
  branchId: string;
  workerId: string;
  description: string;
  category: string;
  size?: string;
  pieces?: number;
  costPerSheet?: number;
  grossProfit?: number;
  netProfit?: number;
  transportCost?: number;
  billPhotoURL?: string;
  createdAt: any; // Firestore Timestamp
  syncStatus: "pending" | "synced" | "failed";
};

export type SalesEntry = {
  id: string;
  date: string | Date;
  size: string;
  pieces: number;
  amount: number;
  branchId: string;
  workerId: string;
  createdBy: string;
  createdAt: any; // Firestore ServerTimestamp
  costPerSheet: number | null;
  grossProfit: number | null;
  netProfit: number | null;
  syncStatus: 'pending' | 'synced' | 'failed';
}

export type StockItem = {
    size: string;
    pieces: number;
    weight: number;
}

export type Purchase = {
    id: string;
    date: Date;
    vendor: string;
    totalCost: number;
    transportCost?: number;
    gst?: number;
    stock: StockItem[];
    totalKg: number;
    avgCostPerKg: number;
    billPhotoURL: string | null;
    createdAt: any; // Firestore ServerTimestamp
    createdBy: string;
}

export type AggregateSummary = {
  totalSales: number;
  totalExpenses: number;
  totalProfit: number;
  lastUpdated: any; // Firestore Timestamp
};

export type MonthlyAggregate = {
  month: string; // YYYY-MM
  salesTotal: number;
  expensesTotal: number;
  profitTotal: number;
  salesByBranch: { [branchId: string]: number };
  expensesByBranch: { [branchId: string]: number };
  profitByBranch: { [branchId: string]: number };
};

export type AuditLog = {
  id?: string;
  action: "create" | "update" | "delete";
  collection: string;
  docId: string;
  userId: string;
  before: object | null;
  after: object | null;
  timestamp: any; // Firestore Timestamp
};

export type AppRelease = {
  id?: string;
  versionCode: number;
  versionName: string;
  url: string;
  changelog: string;
  mandatory: boolean;
  releaseDate: any; // Firestore Timestamp
  sha256: string;
};

export type UserProfile = {
    id: string;
    email: string;
    roleId: string;
};

export type Role = {
    id: string;
    name: string;
    permissions: string[];
};
