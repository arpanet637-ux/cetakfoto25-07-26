import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@getmocha/users-service/react";
import type { Branch, CreateBranch, UpdateBranch } from "@/shared/types";

export function useBranches() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBranches = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/branches", { credentials: "include" });
      if (!response.ok) throw new Error("Gagal memuat cabang");
      const data = await response.json();
      setBranches(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }, []);

  // Only fetch when user is authenticated
  useEffect(() => {
    if (user) {
      fetchBranches();
    }
  }, [fetchBranches, user]);

  const createBranch = async (data: CreateBranch) => {
    const response = await fetch("/api/branches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Gagal membuat cabang");
    const newBranch = await response.json();
    setBranches((prev) => [...prev, newBranch].sort((a, b) => a.name.localeCompare(b.name)));
    return newBranch;
  };

  const updateBranch = async (id: number, data: UpdateBranch) => {
    const response = await fetch(`/api/branches/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Gagal mengupdate cabang");
    const updated = await response.json();
    setBranches((prev) =>
      prev.map((b) => (b.id === id ? updated : b)).sort((a, b) => a.name.localeCompare(b.name))
    );
    return updated;
  };

  const deleteBranch = async (id: number) => {
    const response = await fetch(`/api/branches/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) throw new Error("Gagal menghapus cabang");
    setBranches((prev) => prev.filter((b) => b.id !== id));
  };

  return {
    branches,
    loading,
    error,
    fetchBranches,
    createBranch,
    updateBranch,
    deleteBranch,
  };
}
