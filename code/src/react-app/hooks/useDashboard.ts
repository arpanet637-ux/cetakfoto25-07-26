import { useState, useEffect, useCallback } from 'react';
import { useAuth } from "@getmocha/users-service/react";

interface DashboardStats {
  totalActiveOrders: number;
  pendingVendor: number;
  deadlineToday: number;
  unpaidOrders: number;
}

interface DeadlineNotification {
  id: number;
  order_id: number;
  order_number: string;
  client_name: string;
  product_name: string;
  method: string;
  deadline_date: string;
  status: string;
}

interface VendorNotification {
  id: number;
  order_id: number;
  order_number: string;
  client_name: string;
  product_name: string;
  status_send: string;
  status_payment: string;
  status_pickup: string;
  deadline_date: string;
}

interface StockNotification {
  id: number;
  name: string;
  stock: number;
  min_stock: number;
}

interface PaymentStatusNotification {
  id: number;
  order_number: string;
  client_name: string;
  total_amount: number;
  paid_amount: number;
  created_at: string;
  nearest_deadline: string | null;
}

interface OrderItem {
  id: number;
  product_name: string;
  method: string;
  deadline_date: string;
  status_work: string | null;
  status_pickup: string | null;
}

interface RecentOrder {
  id: number;
  order_number: string;
  client_name: string;
  total_amount: number;
  items: OrderItem[];
}

export function useDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [deadlineNotifications, setDeadlineNotifications] = useState<DeadlineNotification[]>([]);
  const [vendorNotifications, setVendorNotifications] = useState<VendorNotification[]>([]);
  const [stockNotifications, setStockNotifications] = useState<StockNotification[]>([]);
  const [paymentStatusNotifications, setPaymentStatusNotifications] = useState<PaymentStatusNotification[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, deadlineRes, vendorRes, stockRes, paymentStatusRes, ordersRes] = await Promise.all([
        fetch('/api/dashboard/stats', { credentials: 'include' }),
        fetch('/api/dashboard/notifications/deadline', { credentials: 'include' }),
        fetch('/api/dashboard/notifications/vendor', { credentials: 'include' }),
        fetch('/api/dashboard/notifications/stock', { credentials: 'include' }),
        fetch('/api/dashboard/notifications/payment-status', { credentials: 'include' }),
        fetch('/api/orders', { credentials: 'include' }),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (deadlineRes.ok) {
        const deadlineData = await deadlineRes.json();
        setDeadlineNotifications(deadlineData);
      }

      if (vendorRes.ok) {
        const vendorData = await vendorRes.json();
        setVendorNotifications(vendorData);
      }

      if (stockRes.ok) {
        const stockData = await stockRes.json();
        setStockNotifications(stockData);
      }

      if (paymentStatusRes.ok) {
        const paymentStatusData = await paymentStatusRes.json();
        setPaymentStatusNotifications(paymentStatusData);
      }

      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        // Get the 5 most recent orders
        setRecentOrders(ordersData.slice(0, 5));
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Only fetch when user is authenticated
  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [fetchDashboardData, user]);

  return {
    stats,
    deadlineNotifications,
    vendorNotifications,
    stockNotifications,
    paymentStatusNotifications,
    recentOrders,
    loading,
    refetch: fetchDashboardData,
  };
}
