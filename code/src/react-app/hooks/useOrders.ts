import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@getmocha/users-service/react";
import type { OrderWithItems, UpdateOrderItem } from "@/shared/types";

export function useOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isInitialLoad = useRef(true);

  const fetchOrders = useCallback(async (search = "", status = "", branch = "", showLoading = true) => {
    // Don't fetch if user is not authenticated yet
    if (!user) {
      setLoading(false);
      return;
    }
    
    try {
      // Only show loading spinner on initial load or explicit requests
      if (showLoading && isInitialLoad.current) {
        setLoading(true);
      }
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      if (branch) params.set("branch", branch);
      
      const res = await fetch(`/api/orders?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch orders");
      const data = await res.json();
      setOrders(data);
      setError(null);
      isInitialLoad.current = false;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Silent refresh - updates data without showing loading spinner but shows updating indicator
  const silentRefresh = useCallback(async () => {
    // Don't fetch if user is not authenticated yet
    if (!user) {
      return;
    }
    
    try {
      setUpdating(true);
      const res = await fetch(`/api/orders`, { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch orders");
      const data = await res.json();
      setOrders(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setUpdating(false);
    }
  }, [user]);

  // Only fetch when user is authenticated
  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [fetchOrders, user]);

  const createOrder = async (data: {
    client_name: string;
    client_phone?: string;
    notes?: string;
    discount?: number;
    branch_id?: number;
    items: Array<{
      product_id?: number;
      product_name: string;
      quantity: number;
      unit_price: number;
      discount: number;
      method: "cetak_sendiri" | "tim_produksi";
      deadline_date: string;
    }>;
  }) => {
    const res = await fetch("/api/orders", {
      method: "POST",
      credentials: 'include',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: data.client_name,
        client_phone: data.client_phone || null,
        client_address: null,
        notes: data.notes || null,
        discount: data.discount || 0,
        branch_id: data.branch_id || null,
        total_amount: 0,
        paid_amount: 0,
      }),
    });
    if (!res.ok) throw new Error("Failed to create order");
    const order = await res.json();

    // Add items
    for (const item of data.items) {
      const subtotal = item.quantity * item.unit_price - item.discount;
      await fetch(`/api/orders/${order.id}/items`, {
        method: "POST",
        credentials: 'include',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...item,
          subtotal,
        }),
      });
    }

    await silentRefresh();
    return order;
  };

  const updateOrder = async (
    id: number,
    data: {
      client_name?: string;
      client_phone?: string;
      client_address?: string;
      notes?: string;
      paid_amount?: number;
      discount?: number;
      branch_id?: number | null;
      pickup_status?: "belum_diambil" | "sudah_diambil";
      pickup_date?: string;
      pickup_photo_key?: string;
      payment_method?: "cash" | "transfer";
    }
  ) => {
    const res = await fetch(`/api/orders/${id}`, {
      method: "PUT",
      credentials: 'include',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update order");
    await silentRefresh();
  };

  const deleteOrder = async (id: number) => {
    const res = await fetch(`/api/orders/${id}`, { method: "DELETE", credentials: 'include' });
    if (!res.ok) throw new Error("Failed to delete order");
    await silentRefresh();
  };

  const updateOrderItem = async (
    orderId: number,
    itemId: number,
    data: UpdateOrderItem
  ) => {
    const res = await fetch(`/api/orders/${orderId}/items/${itemId}`, {
      method: "PUT",
      credentials: 'include',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update item");
    await silentRefresh();
  };

  const addOrderItem = async (
    orderId: number,
    item: {
      product_id?: number;
      product_name: string;
      quantity: number;
      unit_price: number;
      discount: number;
      method: "cetak_sendiri" | "tim_produksi";
      deadline_date: string;
    }
  ) => {
    const subtotal = item.quantity * item.unit_price - item.discount;
    const res = await fetch(`/api/orders/${orderId}/items`, {
      method: "POST",
      credentials: 'include',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...item, subtotal }),
    });
    if (!res.ok) throw new Error("Failed to add item");
    await silentRefresh();
  };

  const deleteOrderItem = async (orderId: number, itemId: number) => {
    const res = await fetch(`/api/orders/${orderId}/items/${itemId}`, {
      method: "DELETE",
      credentials: 'include',
    });
    if (!res.ok) throw new Error("Failed to delete item");
    await silentRefresh();
  };

  return {
    orders,
    loading,
    updating,
    error,
    fetchOrders,
    silentRefresh,
    createOrder,
    updateOrder,
    deleteOrder,
    updateOrderItem,
    addOrderItem,
    deleteOrderItem,
  };
}
