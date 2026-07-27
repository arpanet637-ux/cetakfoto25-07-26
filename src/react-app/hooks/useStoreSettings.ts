import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/react-app/App";
import type { StoreSettings, UpdateStoreSettings } from "@/shared/types";

export type { StoreSettings, UpdateStoreSettings };

export function useStoreSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/settings");
      if (!response.ok) throw new Error(`Failed to fetch settings: ${response.statusText}`);
      const data = await response.json();
      setSettings(data ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSettings = async (updates: UpdateStoreSettings): Promise<StoreSettings> => {
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...settings, ...updates }),
    });
    if (!response.ok) throw new Error(`Failed to update settings: ${response.statusText}`);
    const data = await response.json();
    setSettings(data);
    return data;
  };

  useEffect(() => {
    if (user) fetchSettings();
  }, [fetchSettings, user]);

  return { settings, loading, error, fetchSettings, updateSettings };
}
