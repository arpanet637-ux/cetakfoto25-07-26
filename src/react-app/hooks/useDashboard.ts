import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/react-app/lib/supabase";
import { useAuth } from "@/react-app/App";
import type { OrderWithItems } from "@/shared/types";

export type DashboardStats = {
  totalActiveOrders: number;
  pendingVendor: number;
  deadlineToday: number;
  unpaidOrders: number;
  monthlyRevenue: number;
  revenueGrowth: number;
};

export type DeadlineNotification = {
  id: number;
  order_id: number;
  order_number: string;
  client_name: string;
  product_name: string;
  method: string;
  deadline_date: string;
};

export type VendorNotification = {
  id: number;
  order_id: number;
  order_number: string;
  client_name: string;
  product_name: string;
  deadline_date: string;
  status_send: string | null;
  status_payment: string | null;
  status_pickup: string | null;
};

export type StockNotification = {
  id: number;
  name: string;
  stock: number;
  min_stock: number;
};

export type PaymentStatusNotification = {
  id: number;
  order_number: string;
  client_name: string;
  paid_amount: number;
  total_amount: number;
  nearest_deadline: string | null;
};

const todayISO = () => new Date().toISOString().split("T")[0];

/** Earliest non-empty deadline among a set of items. */
function nearestDeadline(items: { deadline_date?: string | null }[]): string | null {
  const dates = items.map((i) => i.deadline_date).filter((d): d is string => !!d);
  if (dates.length === 0) return null;
  return dates.reduce((prev, curr) => (curr < prev ? curr : prev));
}

export function useDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [deadlineNotifications, setDeadlineNotifications] = useState<DeadlineNotification[]>([]);
  const [vendorNotifications, setVendorNotifications] = useState<VendorNotification[]>([]);
  const [stockNotifications, setStockNotifications] = useState<StockNotification[]>([]);
  const [paymentStatusNotifications, setPaymentStatusNotifications] = useState<PaymentStatusNotification[]>([]);
  const [recentOrders, setRecentOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);

      const [{ data: orderRows }, { data: itemRows }, { data: productRows }] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("order_items").select("*"),
        supabase.from("products").select("*"),
      ]);

      const orders = orderRows ?? [];
      const items = itemRows ?? [];
      const products = productRows ?? [];

      const itemsByOrder = new Map<number, any[]>();
      for (const item of items) {
        const list = itemsByOrder.get(item.order_id) ?? [];
        list.push(item);
        itemsByOrder.set(item.order_id, list);
      }
      const orderById = new Map<number, any>(orders.map((o) => [o.id, o]));

      const today = todayISO();

      // --- Stats -------------------------------------------------------
      const activeOrders = orders.filter(
        (o) => (o.paid_amount ?? 0) < (o.total_amount ?? 0) || o.pickup_status !== "sudah_diambil"
      );
      const unpaidOrders = orders.filter((o) => (o.paid_amount ?? 0) < (o.total_amount ?? 0));

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

      const sumPaid = (list: any[]) => list.reduce((sum, o) => sum + (o.paid_amount || 0), 0);
      const monthlyRevenue = sumPaid(orders.filter((o) => o.created_at >= startOfMonth));
      const lastMonthRevenue = sumPaid(
        orders.filter((o) => o.created_at >= startOfLastMonth && o.created_at < startOfMonth)
      );
      const revenueGrowth =
        lastMonthRevenue > 0 ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0;

      const pendingVendor = items.filter(
        (i) => i.method === "tim_produksi" && i.status_send !== "sudah_dikirim"
      ).length;

      setStats({
        totalActiveOrders: activeOrders.length,
        pendingVendor,
        deadlineToday: items.filter((i) => i.deadline_date === today).length,
        unpaidOrders: unpaidOrders.length,
        monthlyRevenue,
        revenueGrowth,
      });

      // --- Deadlines within the next 3 days ----------------------------
      const in3Days = new Date();
      in3Days.setDate(in3Days.getDate() + 3);
      const threeDays = in3Days.toISOString().split("T")[0];

      setDeadlineNotifications(
        items
          .filter((i) => i.deadline_date && i.deadline_date >= today && i.deadline_date <= threeDays)
          .map((i) => {
            const order = orderById.get(i.order_id);
            return {
              id: i.id,
              order_id: i.order_id,
              order_number: order?.order_number ?? "",
              client_name: order?.client_name ?? "",
              product_name: i.product_name ?? "",
              method: i.method ?? "cetak_sendiri",
              deadline_date: i.deadline_date,
            };
          })
          .sort((a, b) => a.deadline_date.localeCompare(b.deadline_date))
      );

      // --- Vendor items still needing action ---------------------------
      setVendorNotifications(
        items
          .filter(
            (i) =>
              i.method === "tim_produksi" &&
              (i.status_send !== "sudah_dikirim" ||
                i.status_payment !== "sudah_bayar" ||
                i.status_pickup !== "sudah_diambil")
          )
          .map((i) => {
            const order = orderById.get(i.order_id);
            return {
              id: i.id,
              order_id: i.order_id,
              order_number: order?.order_number ?? "",
              client_name: order?.client_name ?? "",
              product_name: i.product_name ?? "",
              deadline_date: i.deadline_date ?? "",
              status_send: i.status_send ?? "belum_dikirim",
              status_payment: i.status_payment ?? "belum_bayar",
              status_pickup: i.status_pickup ?? "belum_diambil",
            };
          })
      );

      // --- Low stock ---------------------------------------------------
      setStockNotifications(
        products
          .filter((p) => (p.min_stock ?? 0) > 0 && (p.stock ?? 0) <= (p.min_stock ?? 0))
          .map((p) => ({ id: p.id, name: p.name, stock: p.stock ?? 0, min_stock: p.min_stock ?? 0 }))
      );

      // --- Payment status for the newest orders -------------------------
      setPaymentStatusNotifications(
        orders.slice(0, 20).map((o) => ({
          id: o.id,
          order_number: o.order_number ?? "",
          client_name: o.client_name ?? "",
          paid_amount: o.paid_amount ?? 0,
          total_amount: o.total_amount ?? 0,
          nearest_deadline: nearestDeadline(itemsByOrder.get(o.id) ?? []),
        }))
      );

      // --- Recent orders table -----------------------------------------
      setRecentOrders(
        orders.slice(0, 5).map((o) => ({
          ...o,
          items: itemsByOrder.get(o.id) ?? [],
          payments: [],
        })) as OrderWithItems[]
      );

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return {
    stats,
    deadlineNotifications,
    vendorNotifications,
    stockNotifications,
    paymentStatusNotifications,
    recentOrders,
    loading,
    error,
    fetchDashboard,
  };
}
