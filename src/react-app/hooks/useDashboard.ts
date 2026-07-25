import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/react-app/lib/supabase";
import { useAuth } from "@/react-app/App";
import type { DashboardStats, DeadlineNotification, StockNotification } from "@/shared/types";

export function useDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [deadlines, setDeadlines] = useState<DeadlineNotification[]>([]);
  const [stockAlerts, setStockAlerts] = useState<StockNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);

      // Fetch orders
      const { data: allOrders } = await supabase.from("orders").select("*");
      const orders = allOrders ?? [];

      // Active orders (not fully paid or not picked up)
      const activeOrders = orders.filter(
        (o) => o.paid_amount < o.total_amount || o.pickup_status !== "sudah_diambil"
      );

      // Monthly revenue
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const monthOrders = orders.filter((o) => o.created_at >= startOfMonth);
      const monthlyRevenue = monthOrders.reduce((sum, o) => sum + (o.paid_amount || 0), 0);

      // Previous month for growth
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const endOfLastMonth = startOfMonth;
      const lastMonthOrders = orders.filter((o) => o.created_at >= startOfLastMonth && o.created_at < endOfLastMonth);
      const lastMonthRevenue = lastMonthOrders.reduce((sum, o) => sum + (o.paid_amount || 0), 0);
      const revenueGrowth = lastMonthRevenue > 0 ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0;

      // Fetch order items for deadlines and vendor status
      const { data: allItems } = await supabase.from("order_items").select("*");
      const items = allItems ?? [];

      const today = new Date().toISOString().split("T")[0];
      const pendingVendor = items.filter(
        (i) => i.method === "tim_produksi" && i.status_send !== "sudah_dikirim"
      ).length;

      const deadlineToday = items.filter((i) => i.deadline_date === today).length;

      setStats({
        totalActiveOrders: activeOrders.length,
        pendingVendor,
        deadlineToday,
        monthlyRevenue,
        revenueGrowth,
      });

      // Deadline notifications (within 3 days)
      const threeDaysLater = new Date();
      threeDaysLater.setDate(threeDaysLater.getDate() + 3);
      const threeDays = threeDaysLater.toISOString().split("T")[0];

      const upcomingDeadlines = items
        .filter((i) => i.deadline_date >= today && i.deadline_date <= threeDays)
        .map((i) => {
          const order = orders.find((o) => o.id === i.order_id);
          return {
            id: i.id,
            order_id: i.order_id,
            order_number: order?.order_number ?? "",
            client_name: order?.client_name ?? "",
            product_name: i.product_name,
            method: i.method,
            status: i.method === "cetak_sendiri" ? (i.status_work ?? "belum_dikerjakan") : (i.status_send ?? "belum_dikirim"),
            deadline_date: i.deadline_date,
          };
        });
      setDeadlines(upcomingDeadlines);

      // Stock alerts
      const { data: products } = await supabase.from("products").select("id, name, stock, min_stock");
      const alerts = (products ?? [])
        .filter((p) => p.stock <= p.min_stock && p.min_stock > 0)
        .map((p) => ({ id: p.id, name: p.name, stock: p.stock, min_stock: p.min_stock }));
      setStockAlerts(alerts);

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

  return { stats, deadlines, stockAlerts, loading, error, fetchDashboard };
}
