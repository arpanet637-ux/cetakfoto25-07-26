import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@getmocha/users-service/react";

export interface Expense {
  id: number;
  expense_type: string;
  description: string;
  amount: number;
  expense_date: string;
  vendor_name: string | null;
  order_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseSummary {
  operasional: number;
  vendor: number;
  total: number;
}

export function useExpenses() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary>({ operasional: 0, vendor: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExpenses = useCallback(async (type?: string, startDate?: string, endDate?: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (type) params.append("type", type);
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      
      const url = `/api/expenses${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch expenses");
      const data = await res.json();
      setExpenses(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSummary = useCallback(async (month?: string) => {
    try {
      const url = `/api/expenses/summary/total${month ? `?month=${month}` : ""}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch summary");
      const data = await res.json();
      setSummary(data);
    } catch (err) {
      console.error("Failed to fetch expense summary:", err);
    }
  }, []);

  // Only fetch when user is authenticated
  useEffect(() => {
    if (user) {
      fetchExpenses();
      fetchSummary();
    }
  }, [fetchExpenses, fetchSummary, user]);

  const createExpense = async (data: Omit<Expense, "id" | "created_at" | "updated_at">) => {
    const res = await fetch("/api/expenses", {
      method: "POST",
      credentials: 'include',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create expense");
    await fetchExpenses();
    await fetchSummary();
  };

  const updateExpense = async (id: number, data: Partial<Expense>) => {
    const res = await fetch(`/api/expenses/${id}`, {
      method: "PUT",
      credentials: 'include',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update expense");
    await fetchExpenses();
    await fetchSummary();
  };

  const deleteExpense = async (id: number) => {
    const res = await fetch(`/api/expenses/${id}`, {
      method: "DELETE",
      credentials: 'include',
    });
    if (!res.ok) throw new Error("Failed to delete expense");
    await fetchExpenses();
    await fetchSummary();
  };

  return {
    expenses,
    summary,
    loading,
    error,
    fetchExpenses,
    fetchSummary,
    createExpense,
    updateExpense,
    deleteExpense,
  };
}
