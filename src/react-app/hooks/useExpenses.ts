import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/react-app/lib/supabase";
import { useAuth } from "@/react-app/App";
import type { Expense, CreateExpense, UpdateExpense } from "@/shared/types";

export function useExpenses() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("expenses")
        .select("*")
        .order("expense_date", { ascending: false });
      if (err) throw new Error(err.message);
      setExpenses(data ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const createExpense = async (expense: CreateExpense): Promise<Expense> => {
    const { data, error: err } = await supabase
      .from("expenses")
      .insert(expense)
      .select()
      .single();
    if (err) throw new Error(err.message);
    setExpenses((prev) => [data, ...prev]);
    return data;
  };

  const updateExpense = async (id: number, updates: UpdateExpense): Promise<Expense> => {
    const { data, error: err } = await supabase
      .from("expenses")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (err) throw new Error(err.message);
    setExpenses((prev) => prev.map((e) => (e.id === id ? data : e)));
    return data;
  };

  const deleteExpense = async (id: number): Promise<void> => {
    const { error: err } = await supabase.from("expenses").delete().eq("id", id);
    if (err) throw new Error(err.message);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  useEffect(() => {
    if (user) fetchExpenses();
  }, [fetchExpenses, user]);

  return { expenses, loading, error, fetchExpenses, createExpense, updateExpense, deleteExpense };
}
