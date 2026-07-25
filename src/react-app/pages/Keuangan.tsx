import { useState, useEffect, useMemo } from "react";
import MainLayout from "@/react-app/components/layout/MainLayout";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import {
  Lock,
  Eye,
  EyeOff,
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  Wallet,
  Building2,
  Wrench,
  Loader2,
  Calendar,
  MapPin,
} from "lucide-react";
import { useExpenses, type Expense } from "@/react-app/hooks/useExpenses";
import { useBranches } from "@/react-app/hooks/useBranches";
import { supabase } from "@/react-app/lib/supabase";
import ExpenseFormModal from "@/react-app/components/finance/ExpenseFormModal";
import DeleteConfirmModal from "@/react-app/components/shared/DeleteConfirmModal";

const CORRECT_PIN = "824642";

type DatePeriod = "today" | "week" | "month" | "all" | "custom";

// Format date to YYYY-MM-DD in local timezone
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

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export default function KeuanganPage() {
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinError, setPinError] = useState("");

  const [income, setIncome] = useState(0);
  const [filterType, setFilterType] = useState<string>("all");
  const [datePeriod, setDatePeriod] = useState<DatePeriod>("month");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [branchFilter, setBranchFilter] = useState<string>("all");

  const { branches } = useBranches();

  const dateRange = useMemo(
    () => getDateRange(datePeriod, customStartDate, customEndDate),
    [datePeriod, customStartDate, customEndDate]
  );

  const {
    expenses,
    loading,
    createExpense,
    updateExpense,
    deleteExpense,
  } = useExpenses();

  // Fetch income from orders (only picked up orders count as income)
  useEffect(() => {
    if (isUnlocked) {
      supabase
        .from("orders")
        .select("*")
        .then(({ data: orders }) => {
          const pickedUpOrders = (orders ?? []).filter((order: { pickup_status: string; pickup_date: string | null; paid_amount: number; branch_id: number | null }) => {
            if (order.pickup_status !== "sudah_diambil") return false;
            if (branchFilter !== "all" && order.branch_id !== parseInt(branchFilter)) return false;
            if (datePeriod === "all" || !dateRange.start || !dateRange.end) return true;
            if (!order.pickup_date) return false;
            const pickupDate = order.pickup_date.replace(" ", "T").split("T")[0];
            return pickupDate >= dateRange.start && pickupDate <= dateRange.end;
          });
          const totalIncome = pickedUpOrders.reduce(
            (sum: number, order: { paid_amount: number }) => sum + order.paid_amount,
            0
          );
          setIncome(totalIncome);
        });
    }
  }, [isUnlocked, datePeriod, dateRange.start, dateRange.end, branchFilter]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === CORRECT_PIN) {
      setIsUnlocked(true);
      setPinError("");
    } else {
      setPinError("PIN salah. Silakan coba lagi.");
      setPin("");
    }
  };

  const filteredExpenses = expenses.filter((expense) => {
    const typeMatch = filterType === "all" || expense.expense_type === filterType;
    if (datePeriod === "all" || !dateRange.start || !dateRange.end) return typeMatch;
    // Handle both date formats
    const expenseDate = expense.expense_date.replace(" ", "T").split("T")[0];
    const dateMatch = expenseDate >= dateRange.start && expenseDate <= dateRange.end;
    return typeMatch && dateMatch;
  });

  // Calculate summary based on filtered expenses
  const filteredSummary = useMemo(() => {
    const operasional = filteredExpenses
      .filter((e) => e.expense_type === "operasional")
      .reduce((sum, e) => sum + e.amount, 0);
    const vendor = filteredExpenses
      .filter((e) => e.expense_type === "vendor")
      .reduce((sum, e) => sum + e.amount, 0);
    return { operasional, vendor, total: operasional + vendor };
  }, [filteredExpenses]);

  const netProfit = income - filteredSummary.total;

  if (!isUnlocked) {
    return (
      <MainLayout title="Keuangan" subtitle="Akses memerlukan PIN">
        <div className="mx-auto max-w-md">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-lg">
            <div className="mb-6 flex flex-col items-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Lock className="h-8 w-8 text-primary" />
              </div>
              <h2 className="mt-4 text-xl font-semibold text-foreground">
                Modul Keuangan Terkunci
              </h2>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Masukkan PIN 6 digit untuk mengakses laporan keuangan
              </p>
            </div>

            <form onSubmit={handlePinSubmit}>
              <div className="relative">
                <Input
                  type={showPin ? "text" : "password"}
                  placeholder="Masukkan PIN"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setPinError("");
                  }}
                  className="pr-10 text-center text-2xl tracking-[0.5em] font-mono"
                  maxLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPin ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>

              {pinError && (
                <p className="mt-2 text-center text-sm text-destructive">
                  {pinError}
                </p>
              )}

              <Button
                type="submit"
                className="mt-4 w-full"
                disabled={pin.length !== 6}
              >
                Buka Kunci
              </Button>
            </form>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Keuangan" subtitle="Laporan keuangan bisnis Anda">
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-green-100/50 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/20">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-sm font-medium text-green-700">Total Pendapatan</p>
          </div>
          <p className="mt-3 text-3xl font-bold text-green-800">
            {formatCurrency(income)}
          </p>
          <p className="mt-1 text-sm text-green-600">Dari pesanan yang sudah diambil</p>
        </div>

        <div className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-red-100/50 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/20">
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
            <p className="text-sm font-medium text-red-700">Total Pengeluaran</p>
          </div>
          <p className="mt-3 text-3xl font-bold text-red-800">
            {formatCurrency(filteredSummary.total)}
          </p>
          <p className="mt-1 text-sm text-red-600">
            Operasional: {formatCurrency(filteredSummary.operasional)} | Vendor: {formatCurrency(filteredSummary.vendor)}
          </p>
        </div>

        <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-primary/15 p-6 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-medium text-primary">Laba Bersih</p>
          </div>
          <p className={`mt-3 text-3xl font-bold ${netProfit >= 0 ? "text-foreground" : "text-red-600"}`}>
            {formatCurrency(netProfit)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Pendapatan - Pengeluaran
          </p>
        </div>
      </div>

      {/* Expenses Section */}
      <div className="mt-8">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-foreground">Daftar Pengeluaran</h2>
          <div className="flex gap-3">
            {/* Filter */}
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-1">
              <button
                onClick={() => setFilterType("all")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  filterType === "all"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setFilterType("operasional")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  filterType === "operasional"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Operasional
              </button>
              <button
                onClick={() => setFilterType("vendor")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  filterType === "vendor"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Vendor
              </button>
            </div>

            <Button onClick={() => setShowExpenseModal(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Tambah Pengeluaran</span>
              <span className="sm:hidden">Tambah</span>
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Wallet className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {filterType === "all"
                ? "Belum ada pengeluaran"
                : `Belum ada pengeluaran ${filterType}`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredExpenses.map((expense) => (
              <div
                key={expense.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/30"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      expense.expense_type === "vendor"
                        ? "bg-purple-100 text-purple-600"
                        : "bg-orange-100 text-orange-600"
                    }`}
                  >
                    {expense.expense_type === "vendor" ? (
                      <Building2 className="h-5 w-5" />
                    ) : (
                      <Wrench className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {expense.description}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{formatDate(expense.expense_date)}</span>
                      {expense.vendor_name && (
                        <>
                          <span>•</span>
                          <span>{expense.vendor_name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-semibold text-red-600">
                    -{formatCurrency(expense.amount)}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditingExpense(expense);
                        setShowExpenseModal(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeletingExpense(expense)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expense Form Modal */}
      {showExpenseModal && (
        <ExpenseFormModal
          expense={editingExpense}
          onClose={() => {
            setShowExpenseModal(false);
            setEditingExpense(null);
          }}
          onSave={async (data) => {
            if (editingExpense) {
              await updateExpense(editingExpense.id, data);
            } else {
              await createExpense(data);
            }
          }}
        />
      )}

      {/* Delete Confirm Modal */}
      {deletingExpense && (
        <DeleteConfirmModal
          open={!!deletingExpense}
          onOpenChange={(open) => !open && setDeletingExpense(null)}
          title="Hapus Pengeluaran"
          description={`Yakin ingin menghapus pengeluaran "${deletingExpense.description}"?`}
          onConfirm={async () => {
            await deleteExpense(deletingExpense.id);
            setDeletingExpense(null);
          }}
        />
      )}
    </MainLayout>
  );
}
