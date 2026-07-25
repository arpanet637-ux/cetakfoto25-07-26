import { useState, useEffect, useRef, useMemo } from "react";
import MainLayout from "@/react-app/components/layout/MainLayout";
import { Button } from "@/react-app/components/ui/button";
import { Plus, Search, ShoppingCart, Filter, Loader2, Download, Upload, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Building2 } from "lucide-react";
import { Input } from "@/react-app/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/react-app/components/ui/select";
import { useOrders } from "@/react-app/hooks/useOrders";
import { useProducts } from "@/react-app/hooks/useProducts";
import { useBranches } from "@/react-app/hooks/useBranches";
import { supabase } from "@/react-app/lib/supabase";
import OrderFormModal from "@/react-app/components/orders/OrderFormModal";
import OrderCard from "@/react-app/components/orders/OrderCard";
import type { OrderWithItems, OrderItem } from "@/shared/types";

export default function PesananPage() {
  const { orders, loading, updating, fetchOrders, silentRefresh, createOrder, updateOrder, updateOrderItem, addOrderItem, deleteOrderItem, deleteOrder } = useOrders();
  const { products } = useProducts();
  const { branches } = useBranches();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);
  const [urgentCollapsed, setUrgentCollapsed] = useState(false);
  const [safeCollapsed, setSafeCollapsed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if order is urgent (H-1 or past deadline)
  const isOrderUrgent = (order: OrderWithItems): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return order.items.some((item: OrderItem) => {
      // Skip items that are already completed
      if (item.method === "cetak_sendiri" && item.status_work === "selesai") {
        return false;
      }
      if (item.method === "tim_produksi" && item.status_pickup === "sudah_diambil") {
        return false;
      }

      const deadline = new Date(item.deadline_date);
      deadline.setHours(0, 0, 0, 0);
      // Urgent if deadline is today, tomorrow, or already passed
      return deadline <= tomorrow;
    });
  };

  // Separate orders into urgent and safe
  const { urgentOrders, safeOrders } = useMemo(() => {
    const urgent: OrderWithItems[] = [];
    const safe: OrderWithItems[] = [];

    orders.forEach((order) => {
      if (isOrderUrgent(order)) {
        urgent.push(order);
      } else {
        safe.push(order);
      }
    });

    return { urgentOrders: urgent, safeOrders: safe };
  }, [orders]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchOrders(searchQuery, statusFilter === "all" ? "" : statusFilter, branchFilter === "all" ? "" : branchFilter);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, statusFilter, branchFilter, fetchOrders]);

  const handleCreateOrder = async (data: Parameters<typeof createOrder>[0]) => {
    await createOrder(data);
  };

  const handleExport = async () => {
    try {
      const { data: orders } = await supabase.from("orders").select("*");
      const { data: items } = await supabase.from("order_items").select("*");
      const exportData = { orders: orders ?? [], order_items: items ?? [] };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `bisnisKu_pesanan_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      let imported = 0;
      let skipped = 0;
      const ordersToInsert = Array.isArray(data.orders) ? data.orders : (Array.isArray(data) ? data : []);
      
      for (const order of ordersToInsert) {
        const { items, order_items, id, ...orderData } = order;
        const { data: inserted, error } = await supabase
          .from("orders")
          .insert(orderData)
          .select()
          .single();
        if (error) { skipped++; continue; }
        imported++;
        const orderItems = items ?? order_items ?? [];
        if (orderItems.length > 0) {
          await supabase.from("order_items").insert(
            orderItems.map((item: any) => ({ ...item, id: undefined, order_id: inserted.id }))
          );
        }
      }

      setImportResult({
        success: true,
        message: `Berhasil import ${imported} pesanan${skipped > 0 ? `, ${skipped} dilewati` : ""}.`,
      });
      fetchOrders(searchQuery, statusFilter === "all" ? "" : statusFilter);
    } catch {
      setImportResult({
        success: false,
        message: "File tidak valid. Pastikan file adalah backup pesanan BisnisKu.",
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <MainLayout title="Pesanan" subtitle="Kelola semua pesanan pelanggan">
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Import result notification */}
      {importResult && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 text-sm ${
            importResult.success
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {importResult.message}
          <button
            className="ml-2 font-medium underline"
            onClick={() => setImportResult(null)}
          >
            Tutup
          </button>
        </div>
      )}

      {/* Updating indicator */}
      {updating && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 lg:left-auto lg:right-4 lg:translate-x-0">
          <div className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg">
            <Loader2 className="h-4 w-4 animate-spin" />
            Sedang update...
          </div>
        </div>
      )}
      
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari nama klien atau produk..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="belum_dikerjakan">Belum Dikerjakan</SelectItem>
              <SelectItem value="sedang_dikerjakan">Sedang Dikerjakan</SelectItem>
              <SelectItem value="selesai">Selesai</SelectItem>
              <SelectItem value="belum_dikirim">Belum Dikirim</SelectItem>
              <SelectItem value="sudah_dikirim">Sudah Dikirim</SelectItem>
              <SelectItem value="belum_diambil">Belum Diambil</SelectItem>
              <SelectItem value="sudah_diambil">Sudah Diambil</SelectItem>
            </SelectContent>
          </Select>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Building2 className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter Cabang" />
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
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExport} disabled={orders.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" onClick={handleImportClick} disabled={importing}>
            {importing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Import
          </Button>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Buat Pesanan
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <ShoppingCart className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-foreground">
            Belum ada pesanan
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Pesanan baru akan muncul di sini
          </p>
          <Button className="mt-6" onClick={() => setIsModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Buat Pesanan Pertama
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Urgent Orders Section */}
          {urgentOrders.length > 0 && (
            <div>
              <button
                onClick={() => setUrgentCollapsed(!urgentCollapsed)}
                className="mb-4 flex w-full items-center gap-3 text-left"
              >
                <div className="flex items-center gap-2 rounded-lg bg-red-100 px-4 py-2 text-red-700 transition-colors hover:bg-red-200">
                  {urgentCollapsed ? (
                    <ChevronRight className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-semibold">Deadline Mendesak (H-1 atau Lewat)</span>
                  <span className="rounded-full bg-red-200 px-2 py-0.5 text-sm font-bold">
                    {urgentOrders.length}
                  </span>
                </div>
              </button>
              {!urgentCollapsed && (
                <div className="space-y-4">
                  {urgentOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      products={products}
                      branches={branches}
                      onUpdateOrder={updateOrder}
                      onUpdateItem={updateOrderItem}
                      onAddItem={addOrderItem}
                      onDeleteItem={deleteOrderItem}
                      onDeleteOrder={deleteOrder}
                      onPaymentChanged={silentRefresh}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Divider between sections */}
          {urgentOrders.length > 0 && safeOrders.length > 0 && (
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-2 border-dashed border-gray-300" />
              </div>
            </div>
          )}

          {/* Safe Orders Section */}
          {safeOrders.length > 0 && (
            <div>
              <button
                onClick={() => setSafeCollapsed(!safeCollapsed)}
                className="mb-4 flex w-full items-center gap-3 text-left"
              >
                <div className="flex items-center gap-2 rounded-lg bg-green-100 px-4 py-2 text-green-700 transition-colors hover:bg-green-200">
                  {safeCollapsed ? (
                    <ChevronRight className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-semibold">Deadline Aman</span>
                  <span className="rounded-full bg-green-200 px-2 py-0.5 text-sm font-bold">
                    {safeOrders.length}
                  </span>
                </div>
              </button>
              {!safeCollapsed && (
                <div className="space-y-4">
                  {safeOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      products={products}
                      branches={branches}
                      onUpdateOrder={updateOrder}
                      onUpdateItem={updateOrderItem}
                      onAddItem={addOrderItem}
                      onDeleteItem={deleteOrderItem}
                      onDeleteOrder={deleteOrder}
                      onPaymentChanged={silentRefresh}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <OrderFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateOrder}
        products={products}
        branches={branches}
      />
    </MainLayout>
  );
}
