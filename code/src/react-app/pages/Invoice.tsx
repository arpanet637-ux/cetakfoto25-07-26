import { useState } from "react";
import MainLayout from "@/react-app/components/layout/MainLayout";
import { FileText, Search, Eye, Loader2, Building2 } from "lucide-react";
import { Input } from "@/react-app/components/ui/input";
import { Button } from "@/react-app/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/react-app/components/ui/select";
import { useOrders } from "@/react-app/hooks/useOrders";
import { useStoreSettings } from "@/react-app/hooks/useStoreSettings";
import { useBranches } from "@/react-app/hooks/useBranches";
import InvoicePreview from "@/react-app/components/invoice/InvoicePreview";
import type { OrderWithItems } from "@/shared/types";

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

export default function InvoicePage() {
  const { orders, loading } = useOrders();
  const { settings } = useStoreSettings();
  const { branches } = useBranches();
  const [searchQuery, setSearchQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesBranch =
      branchFilter === "all" ||
      (branchFilter === "none" && !order.branch_id) ||
      order.branch_id === parseInt(branchFilter);
    
    return matchesSearch && matchesBranch;
  });

  return (
    <MainLayout title="Invoice" subtitle="Generate nota digital untuk pelanggan">
      {/* Search and Filter */}
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari no. pesanan atau nama klien..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        {branches.length > 0 && (
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Filter cabang" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Cabang</SelectItem>
              <SelectItem value="none">Tanpa Cabang</SelectItem>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id.toString()}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-foreground">
            {searchQuery ? "Pesanan tidak ditemukan" : "Belum ada pesanan"}
          </h3>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            {searchQuery
              ? "Coba kata kunci lain"
              : "Buat pesanan terlebih dahulu di halaman Pesanan"}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              className="group rounded-xl border border-border bg-card p-4 sm:p-5 transition-all hover:border-primary/50 hover:shadow-md"
            >
              <div className="mb-2 sm:mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-xs sm:text-sm font-semibold text-primary">
                    {order.order_number}
                  </span>
                  <h3 className="mt-1 font-semibold text-foreground text-sm sm:text-base truncate">
                    {order.client_name}
                  </h3>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    order.paid_amount >= order.total_amount
                      ? "bg-green-100 text-green-700"
                      : "bg-orange-100 text-orange-700"
                  }`}
                >
                  {order.paid_amount >= order.total_amount
                    ? "Lunas"
                    : "Belum Lunas"}
                </span>
              </div>

              <div className="mb-3 sm:mb-4 space-y-1 text-xs sm:text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Tanggal:</span>
                  <span>{formatDate(order.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Items:</span>
                  <span>{(order.items || []).length} produk</span>
                </div>
                <div className="flex justify-between font-medium text-foreground">
                  <span>Total:</span>
                  <span>{formatCurrency(order.total_amount)}</span>
                </div>
              </div>

              <Button
                className="w-full gap-2"
                onClick={() => setSelectedOrder(order)}
              >
                <Eye className="h-4 w-4" />
                Lihat Invoice
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Invoice Preview Modal */}
      {selectedOrder && (
        <InvoicePreview
          order={selectedOrder}
          storeSettings={settings}
          branches={branches}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </MainLayout>
  );
}
