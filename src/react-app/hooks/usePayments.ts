import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/react-app/lib/supabase";
import { useAuth } from "@/react-app/App";
import type { PaymentRecord, CreatePaymentRecord } from "@/shared/types";

export function usePayments(orderId?: number) {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase.from("payment_records").select("*").order("created_at", { ascending: false });
      if (orderId) query = query.eq("order_id", orderId);
      const { data, error: err } = await query;
      if (err) throw new Error(err.message);
      setPayments(data ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  const createPayment = async (payment: CreatePaymentRecord): Promise<PaymentRecord> => {
    const { data, error: err } = await supabase
      .from("payment_records")
      .insert(payment)
      .select()
      .single();
    if (err) throw new Error(err.message);
    setPayments((prev) => [data, ...prev]);
    return data;
  };

  useEffect(() => {
    if (user) fetchPayments();
  }, [fetchPayments, user]);

  return { payments, loading, error, fetchPayments, createPayment };
}
