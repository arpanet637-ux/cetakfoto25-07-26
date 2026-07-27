import { useState, useEffect, useCallback } from "react";
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
      const response = await fetch("/api/branches").catch(() => null);
      if (!response) {
        setError("Database connection not available. Deploy to Vercel for full functionality.");
        setBranches([]);
        setLoading(false);
        return;
      }
      if (!response.ok) throw new Error(`Failed to fetch branches: ${response.statusText}`);
      const data = await response.json();
      setBranches(data ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const createBranch = async (branch: CreateBranch): Promise<Branch> => {
    try {
      const response = await fetch("/api/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(branch),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to create branch: ${response.statusText}`);
      }
      const data = await response.json();
      setBranches((prev) => [...prev, data]);
      setError(null);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    }
  };

  const updateBranch = async (id: number, updates: UpdateBranch): Promise<Branch> => {
    try {
      const response = await fetch("/api/branches", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to update branch: ${response.statusText}`);
      }
      const data = await response.json();
      setBranches((prev) => prev.map((b) => (b.id === id ? data : b)));
      setError(null);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    }
  };

  const deleteBranch = async (id: number): Promise<void> => {
    try {
      const response = await fetch("/api/branches", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to delete branch: ${response.statusText}`);
      }
      setBranches((prev) => prev.filter((b) => b.id !== id));
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    }
  };

  useEffect(() => {
    if (user) fetchBranches();
  }, [fetchBranches, user]);

  return { branches, loading, error, fetchBranches, createBranch, updateBranch, deleteBranch };
}
