import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@getmocha/users-service/react";

export interface StoreSettings {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  instagram: string | null;
  facebook: string | null;
  admin_fee_qris: number | null;
  admin_fee_va: number | null;
  admin_fee_ewallet: number | null;
  admin_fee_cc: number | null;
  created_at: string;
  updated_at: string;
}

export function useStoreSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed to fetch settings");
      const data = await res.json();
      setSettings(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Only fetch when user is authenticated
  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [fetchSettings, user]);

  const updateSettings = async (data: Partial<StoreSettings>) => {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update settings");
    await fetchSettings();
  };

  return {
    settings,
    loading,
    error,
    fetchSettings,
    updateSettings,
  };
}
