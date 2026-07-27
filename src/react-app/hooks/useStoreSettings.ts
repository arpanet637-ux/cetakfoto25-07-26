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
      const response = await fetch("/api/settings").catch(() => null);
      if (!response) {
        setError("Database connection not available. Deploy to Vercel for full functionality.");
        setSettings(null);
        setLoading(false);
        return;
      }
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
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, ...updates }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to update settings: ${response.statusText}`);
      }
      const data = await response.json();
      setSettings(data);
      setError(null);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    }
  };

  useEffect(() => {
    if (user) fetchSettings();
  }, [fetchSettings, user]);

  return { settings, loading, error, fetchSettings, updateSettings };
}
