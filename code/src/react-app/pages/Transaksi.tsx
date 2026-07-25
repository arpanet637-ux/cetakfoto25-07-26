import { useState, useEffect, useMemo } from "react";
import MainLayout from "@/react-app/components/layout/MainLayout";
import { Input } from "@/react-app/components/ui/input";
import {
  Calendar,
  MapPin,
  Receipt,
  Loader2,
  Banknote,
  CreditCard,
  Package,
  User,
  Camera,
  X,
} from "lucide-react";
import { useBranches } from "@/react-app/hooks/useBranches";

type DatePeriod = "today" | "week" | "month" | "all" | "custom";

interface PaymentRecord {
  id: number;
  order_id: number;
  amount: number;
  payment_method: "cash" | "transfer";
  payment_type: "dp" | "pelunasan";
  created_at: string;
}

interface Transaction {
  id: number;
  order_number: string;
  client_name: string;
  client_phone: string;
  total_amount: number;
  paid_amount: number;
  discount: number;
  payment_method: string | null;
  pickup_status: string;
  pickup_date: string;
  pickup_photo_key: string | null;
  branch_id: number | null;
  created_at: string;
  items: { product_name: string; quantity: number; price: number }[];
  paymentRecords?: PaymentRecord[];
}

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDateRange = (period: DatePeriod, customStart?: string, customEnd?: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  switch (period) {
    case "today": {
      const dateStr = formatLocalDate(today);
      return { start: dateStr, end: dateStr };
    }
    case "week": {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      return { 
        start: formatLocalDate(startOfWeek), 
        end: formatLocalDate(endOfWeek) 
      };
    }
    case "month": {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { 
        start: formatLocalDate(startOfMonth), 
        end: formatLocalDate(endOfMonth) 
      };
    }
    case "custom": {
      return { start: customStart || "", end: customEnd || "" };
    }
    default:
      return { start: "", end: "" };
  }
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
};

const formatDateTime = (dateStr: string) => {
  return new Date(dateStr.replace(" ", "T")).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function TransaksiPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [datePeriod, setDatePeriod] = useState<DatePeriod>("today");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  const [viewingPhoto, setViewingPhoto] = useState<{ url: string; date: string | null; clientName: string } | null>(null);

  const { branches } = useBranches();

  const dateRange = useMemo(
    () => getDateRange(datePeriod, customStartDate, customEndDate),
    [datePeriod, customStartDate, customEndDate]
  );

  // Fetch transactions (picked up orders)
  useEffect(() => {
    const isInitialLoad = transactions.length === 0;
    if (isInitialLoad) {
      setLoading(true);
    } else {
      setUpdating(true);
    }
    
    fetch("/api/orders")
      .then((res) => res.json())
      .then(async (orders) => {
        // Filter only picked up orders first (before payment filter)
        const pickedUpOrders = orders.filter((order: Transaction) => {
          if (order.pickup_status !== "sudah_diambil") return false;
          
          // Filter by branch
          if (branchFilter !== "all" && order.branch_id !== parseInt(branchFilter)) return false;
          
          // Filter by pickup_date
          if (datePeriod === "all" || !dateRange.start || !dateRange.end) return true;
          if (!order.pickup_date) return false;
          
          const pickupDate = order.pickup_date.replace(" ", "T").split("T")[0];
          return pickupDate >= dateRange.start && pickupDate <= dateRange.end;
        });
        
        // Fetch payment records for each order
        const ordersWithPayments = await Promise.all(
          pickedUpOrders.map(async (order: Transaction) => {
            try {
              const res = await fetch(`/api/payments/order/${order.id}`);
              if (res.ok) {
                const records = await res.json();
                return { ...order, paymentRecords: records };
              }
            } catch (e) {
              console.error("Failed to fetch payments for order", order.id, e);
            }
            return { ...order, paymentRecords: [] };
          })
        );
        
        // Apply payment method filter based on payment records
        const filtered = ordersWithPayments.filter((order) => {
          if (paymentMethodFilter === "all") return true;
          
          const records = order.paymentRecords || [];
          if (paymentMethodFilter === "cash") {
            return records.some((r: PaymentRecord) => r.payment_method === "cash");
          }
          if (paymentMethodFilter === "transfer") {
            return records.some((r: PaymentRecord) => r.payment_method === "transfer");
          }
          return true;
        });
        
        // Sort by pickup_date descending
        filtered.sort((a: Transaction, b: Transaction) => {
          const dateA = new Date(a.pickup_date?.replace(" ", "T") || 0);
          const dateB = new Date(b.pickup_date?.replace(" ", "T") || 0);
          return dateB.getTime() - dateA.getTime();
        });
        
        setTransactions(filtered);
        setLoading(false);
        setUpdating(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
        setUpdating(false);
      });
  }, [datePeriod, dateRange.start, dateRange.end, branchFilter, paymentMethodFilter]);

  // Calculate totals from payment records
  const totals = useMemo(() => {
    let cashTotal = 0;
    let transferTotal = 0;
    
    transactions.forEach((t) => {
      const records = t.paymentRecords || [];
      records.forEach((r: PaymentRecord) => {
        if (r.payment_method === "cash") {
          cashTotal += r.amount;
        } else if (r.payment_method === "transfer") {
          transferTotal += r.amount;
        }
      });
    });
    
    const totalPaid = cashTotal + transferTotal;
    
    return { totalPaid, cashTotal, transferTotal, count: transactions.length };
  }, [transactions]);

  const getBranchName = (branchId: number | null) => {
    if (!branchId) return null;
    const branch = branches.find(b => b.id === branchId);
    return branch?.name || null;
  };

  return (
    <MainLayout title="Transaksi" subtitle="Riwayat transaksi pesanan yang sudah diambil">
      {/* Updating Indicator */}
      {updating && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat data...
        </div>
      )}

      {/* Date Period Filter */}
      <div className="mb-6 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Periode:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/50 p-1">
            {[
              { value: "today", label: "Hari Ini" },
              { value: "week", label: "Minggu Ini" },
              { value: "month", label: "Bulan Ini" },
              { value: "all", label: "Semua" },
              { value: "custom", label: "Kustom" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setDatePeriod(option.value as DatePeriod)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  datePeriod === option.value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {datePeriod === "custom" && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-36 text-sm"
              />
              <span className="text-muted-foreground">-</span>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-36 text-sm"
              />
            </div>
          )}
        </div>
        
        {/* Branch Filter */}
        {branches.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>Cabang:</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/50 p-1">
              <button
                onClick={() => setBranchFilter("all")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  branchFilter === "all"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Semua Cabang
              </button>
              {branches.map((branch) => (
                <button
                  key={branch.id}
                  onClick={() => setBranchFilter(String(branch.id))}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    branchFilter === String(branch.id)
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {branch.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Transaksi</p>
              <p className="text-xl font-bold text-foreground">{totals.count}</p>
            </div>
          </div>
        </div>
        
        <div className="rounded-xl border border-green-200 bg-green-50/50 p-4 cursor-pointer transition-all hover:shadow-md hover:border-green-300"
          onClick={() => setPaymentMethodFilter(paymentMethodFilter === "cash" ? "all" : "cash")}
        >
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${paymentMethodFilter === "cash" ? "bg-green-500 text-white" : "bg-green-500/20"}`}>
              <Banknote className={`h-5 w-5 ${paymentMethodFilter === "cash" ? "text-white" : "text-green-600"}`} />
            </div>
            <div>
              <p className="text-sm text-green-700">Total Cash {paymentMethodFilter === "cash" && "(Aktif)"}</p>
              <p className="text-xl font-bold text-green-800">{formatCurrency(totals.cashTotal)}</p>
            </div>
          </div>
        </div>
        
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 cursor-pointer transition-all hover:shadow-md hover:border-blue-300"
          onClick={() => setPaymentMethodFilter(paymentMethodFilter === "transfer" ? "all" : "transfer")}
        >
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${paymentMethodFilter === "transfer" ? "bg-blue-500 text-white" : "bg-blue-500/20"}`}>
              <CreditCard className={`h-5 w-5 ${paymentMethodFilter === "transfer" ? "text-white" : "text-blue-600"}`} />
            </div>
            <div>
              <p className="text-sm text-blue-700">Total Transfer {paymentMethodFilter === "transfer" && "(Aktif)"}</p>
              <p className="text-xl font-bold text-blue-800">{formatCurrency(totals.transferTotal)}</p>
            </div>
          </div>
        </div>
        
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Receipt className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Grand Total</p>
              <p className="text-xl font-bold text-foreground">{formatCurrency(totals.totalPaid)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-12">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Receipt className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Belum ada transaksi pada periode ini
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/30"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-primary">
                      #{transaction.order_number}
                    </span>
                    {/* Show payment method badges from payment records */}
                    {transaction.paymentRecords && transaction.paymentRecords.length > 0 && (() => {
                      const cashAmount = transaction.paymentRecords.filter(r => r.payment_method === "cash").reduce((sum, r) => sum + r.amount, 0);
                      const transferAmount = transaction.paymentRecords.filter(r => r.payment_method === "transfer").reduce((sum, r) => sum + r.amount, 0);
                      return (
                        <>
                          {cashAmount > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                              <Banknote className="h-3 w-3" />
                              Cash {formatCurrency(cashAmount)}
                            </span>
                          )}
                          {transferAmount > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                              <CreditCard className="h-3 w-3" />
                              Transfer {formatCurrency(transferAmount)}
                            </span>
                          )}
                        </>
                      );
                    })()}
                    {getBranchName(transaction.branch_id) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {getBranchName(transaction.branch_id)}
                      </span>
                    )}
                  </div>
                  
                  <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span className="font-medium text-foreground">{transaction.client_name}</span>
                    {transaction.client_phone && (
                      <span>• {transaction.client_phone}</span>
                    )}
                  </div>
                  
                  <div className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                    <Package className="h-4 w-4 mt-0.5" />
                    <div className="flex-1">
                      {transaction.items?.map((item, idx) => (
                        <span key={idx}>
                          {item.quantity}x {item.product_name}
                          {idx < transaction.items.length - 1 && ", "}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mt-2 text-xs text-muted-foreground">
                    <Calendar className="inline h-3 w-3 mr-1" />
                    Diambil: {formatDateTime(transaction.pickup_date)}
                  </div>
                </div>
                
                <div className="text-right">
                  {transaction.discount > 0 && (
                    <p className="text-xs text-muted-foreground line-through">
                      {formatCurrency(transaction.total_amount + transaction.discount)}
                    </p>
                  )}
                  <p className="text-lg font-bold text-foreground">
                    {formatCurrency(transaction.paid_amount)}
                  </p>
                  {transaction.paid_amount < transaction.total_amount && (
                    <p className="text-xs text-amber-600">
                      Kurang: {formatCurrency(transaction.total_amount - transaction.paid_amount)}
                    </p>
                  )}
                  {transaction.pickup_photo_key && (
                    <button
                      onClick={() => setViewingPhoto({ url: `/api/uploads/pickup/${transaction.pickup_photo_key}`, date: transaction.pickup_date, clientName: transaction.client_name })}
                      className="mt-2 inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                    >
                      <Camera className="h-3 w-3" />
                      Lihat Foto
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Photo Viewing Modal */}
      {viewingPhoto && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setViewingPhoto(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setViewingPhoto(null)}
              className="absolute -top-10 right-0 flex items-center gap-1 text-white hover:text-gray-300"
            >
              <X className="h-5 w-5" />
              Tutup
            </button>
            <img
              src={viewingPhoto.url}
              alt="Foto Pengambilan"
              className="max-h-[75vh] max-w-full rounded-t-lg object-contain"
            />
            <div className="rounded-b-lg bg-white p-3 text-center">
              <p className="font-semibold text-foreground">{viewingPhoto.clientName}</p>
              {viewingPhoto.date && (
                <p className="text-sm text-muted-foreground">
                  Diambil: {formatDateTime(viewingPhoto.date)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
