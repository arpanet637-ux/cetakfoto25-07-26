import { useState, useCallback } from "react";
import type { PaymentRecord, CreatePaymentRecord } from "@/shared/types";

export function usePayments(orderId: number | null) {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPayments = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/payments/order/${orderId}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setPayments(data);
      }
    } catch (error) {
      console.error("Failed to fetch payments:", error);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  const createPayment = useCallback(async (data: CreatePaymentRecord) => {
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create payment");
    await fetchPayments();
    return res.json();
  }, [fetchPayments]);

  const deletePayment = useCallback(async (id: number) => {
    const res = await fetch(`/api/payments/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to delete payment");
    await fetchPayments();
  }, [fetchPayments]);

  return {
    payments,
    loading,
    fetchPayments,
    createPayment,
    deletePayment,
  };
}
