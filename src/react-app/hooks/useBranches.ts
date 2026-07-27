import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/react-app/lib/supabase";
import { useAuth } from "@/react-app/App";
import type { Branch, CreateBranch, UpdateBranch } from "@/shared/types";

export function useBranches() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBranches = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("branches")
        .select("*")
        .order("name");
      if (err) throw new Error(err.message);
      setBranches(data ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const createBranch = async (branch: CreateBranch): Promise<Branch> => {
    const { data, error: err } = await supabase
      .from("branches")
      .insert(branch)
      .select()
      .single();
    if (err) throw new Error(err.message);
    setBranches((prev) => [...prev, data]);
    return data;
  };

  const updateBranch = async (id: number, updates: UpdateBranch): Promise<Branch> => {
    const { data, error: err } = await supabase
      .from("branches")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (err) throw new Error(err.message);
    setBranches((prev) => prev.map((b) => (b.id === id ? data : b)));
    return data;
  };

  const deleteBranch = async (id: number): Promise<void> => {
    const { error: err } = await supabase.from("branches").delete().eq("id", id);
    if (err) throw new Error(err.message);
    setBranches((prev) => prev.filter((b) => b.id !== id));
  };

  useEffect(() => {
    if (user) fetchBranches();
  }, [fetchBranches, user]);

  return { branches, loading, error, fetchBranches, createBranch, updateBranch, deleteBranch };
}
