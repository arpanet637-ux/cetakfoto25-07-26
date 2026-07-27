import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/react-app/App";
import type { OrderWithItems, CreateOrderItem, UpdateOrderItem } from "@/shared/types";

export function useOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isInitialLoad = useRef(true);

  const fetchOrders = useCallback(async (search = "", status = "", branch = "", showLoading = true) => {
    if (!user) { setLoading(false); return; }
    try {
      if (showLoading && isInitialLoad.current) setLoading(true);

      const response = await fetch("/api/orders").catch(() => null);
      if (!response) {
        // In dev mode, Neon API may not be available - show message
        setError("Database connection not available. Deploy to Vercel for full functionality.");
        setOrders([]);
        setLoading(false);
        return;
      }
      if (!response.ok) throw new Error(`Failed to fetch orders: ${response.statusText}`);
      
      let result: OrderWithItems[] = await response.json();

      // Apply filters
      if (search) {
        result = result.filter((o) =>
          o.client_name?.toLowerCase().includes(search.toLowerCase()) ||
          o.order_number?.toLowerCase().includes(search.toLowerCase())
        );
      }

      if (branch) {
        result = result.filter((o) => o.branch_id === Number(branch));
      }

      if (status) {
        result = result.filter((o) => {
          if (status === "belum_lunas") return o.paid_amount < o.total_amount;
          if (status === "lunas") return o.paid_amount >= o.total_amount;
          if (status === "sudah_diambil") return o.pickup_status === "sudah_diambil";
          if (status === "belum_diambil") return o.pickup_status === "belum_diambil";
          return true;
        });
      }

      setOrders(result);
      setError(null);
      isInitialLoad.current = false;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [user]);

  const silentRefresh = useCallback(async () => {
    if (!user) return;
    try {
      setUpdating(true);
      await fetchOrders("", "", "", false);
    } finally {
      setUpdating(false);
    }
  }, [fetchOrders, user]);

  const createOrder = async (order: any): Promise<OrderWithItems> => {
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(order),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to create order: ${response.statusText}`);
      }
      
      const result = await response.json();
      setOrders((prev) => [result, ...prev]);
      setError(null);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    }
  };

  const updateOrder = async (id: number, updates: any): Promise<OrderWithItems> => {
    try {
      const response = await fetch("/api/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to update order: ${response.statusText}`);
      }
      
      const updated = await response.json();
      
      // Fetch items for the updated order
      const itemsResponse = await fetch(`/api/orders?id=${id}`);
      const allOrders = await itemsResponse.json();
      const order = allOrders.find((o: any) => o.id === id);
      const result = { ...updated, items: order?.items ?? [] };
      
      setOrders((prev) => prev.map((o) => (o.id === id ? result : o)));
      setError(null);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    }
  };

  const deleteOrder = async (id: number): Promise<void> => {
    try {
      const response = await fetch("/api/orders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to delete order: ${response.statusText}`);
      }
      setOrders((prev) => prev.filter((o) => o.id !== id));
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    }
  };

  /** Recalculate an order's total from its items so header totals never drift. */
  const recalcOrderTotal = async (orderId: number): Promise<void> => {
    const response = await fetch("/api/orders");
    const allOrders = await response.json();
    const order = allOrders.find((o: any) => o.id === orderId);
    if (!order) return;

    const total = (order.items ?? []).reduce(
      (sum: number, i: any) => sum + (i.quantity ?? 0) * (i.unit_price ?? 0) - (i.discount ?? 0),
      0
    );

    await fetch("/api/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: orderId, total_amount: total }),
    });
  };

  const updateOrderItem = async (
    orderId: number,
    _itemId: number,
    _updates: UpdateOrderItem
  ): Promise<void> => {
    // Note: API for individual item updates should be added - for now just refresh
    await recalcOrderTotal(orderId);
    await silentRefresh();
  };

  const addOrderItems = async (orderId: number, _items: CreateOrderItem[]): Promise<void> => {
    // Note: API for adding items should be added - for now just refresh
    await recalcOrderTotal(orderId);
    await silentRefresh();
  };

  /** Single-item convenience wrapper used by the order cards. */
  const addOrderItem = async (orderId: number, item: CreateOrderItem): Promise<void> => {
    await addOrderItems(orderId, [item]);
  };

  const deleteOrderItem = async (orderId: number, _itemId: number): Promise<void> => {
    // Note: API for deleting items should be added - for now just refresh
    await recalcOrderTotal(orderId);
    await silentRefresh();
  };

  useEffect(() => {
    if (user) fetchOrders();
  }, [fetchOrders, user]);

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
    addOrderItems,
    addOrderItem,
    deleteOrderItem,
  };
}
