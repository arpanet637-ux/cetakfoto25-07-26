import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/react-app/lib/supabase";
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

      let query = supabase.from("orders").select("*").order("created_at", { ascending: false });
      if (search) query = query.or(`client_name.ilike.%${search}%,order_number.ilike.%${search}%`);
      if (branch) query = query.eq("branch_id", branch);

      const { data: ordersData, error: err } = await query;
      if (err) throw new Error(err.message);

      const orderIds = (ordersData ?? []).map((o) => o.id);
      let items: any[] = [];
      if (orderIds.length > 0) {
        const { data: itemsData } = await supabase
          .from("order_items")
          .select("*")
          .in("order_id", orderIds);
        items = itemsData ?? [];
      }

      let result: OrderWithItems[] = (ordersData ?? []).map((o) => ({
        ...o,
        items: items.filter((i) => i.order_id === o.id),
      }));

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
    const orderNumber = `ORD-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
    const { items, ...orderData } = order;

    const { data: newOrder, error: err } = await supabase
      .from("orders")
      .insert({ ...orderData, order_number: orderNumber })
      .select()
      .single();
    if (err) throw new Error(err.message);

    let newItems: any[] = [];
    if (items && items.length > 0) {
      const itemsToInsert = items.map((item: CreateOrderItem) => ({
        ...item,
        order_id: newOrder.id,
      }));
      const { data: insertedItems, error: itemErr } = await supabase
        .from("order_items")
        .insert(itemsToInsert)
        .select();
      if (itemErr) throw new Error(itemErr.message);
      newItems = insertedItems ?? [];
    }

    const result = { ...newOrder, items: newItems };
    setOrders((prev) => [result, ...prev]);
    return result;
  };

  const updateOrder = async (id: number, updates: any): Promise<OrderWithItems> => {
    const { data: updated, error: err } = await supabase
      .from("orders")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (err) throw new Error(err.message);

    const { data: items } = await supabase.from("order_items").select("*").eq("order_id", id);
    const result = { ...updated, items: items ?? [] };
    setOrders((prev) => prev.map((o) => (o.id === id ? result : o)));
    return result;
  };

  const deleteOrder = async (id: number): Promise<void> => {
    const { error: err } = await supabase.from("orders").delete().eq("id", id);
    if (err) throw new Error(err.message);
    setOrders((prev) => prev.filter((o) => o.id !== id));
  };

  const updateOrderItem = async (itemId: number, updates: UpdateOrderItem): Promise<void> => {
    const { error: err } = await supabase
      .from("order_items")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", itemId);
    if (err) throw new Error(err.message);
    await silentRefresh();
  };

  const addOrderItems = async (orderId: number, items: CreateOrderItem[]): Promise<void> => {
    const itemsToInsert = items.map((item) => ({ ...item, order_id: orderId }));
    const { error: err } = await supabase.from("order_items").insert(itemsToInsert);
    if (err) throw new Error(err.message);
    await silentRefresh();
  };

  const deleteOrderItem = async (itemId: number): Promise<void> => {
    const { error: err } = await supabase.from("order_items").delete().eq("id", itemId);
    if (err) throw new Error(err.message);
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
    deleteOrderItem,
  };
}
