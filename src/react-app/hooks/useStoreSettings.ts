import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/react-app/lib/supabase";
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
      const { data, error: err } = await supabase
        .from("store_settings")
        .select("*")
        .maybeSingle();
      if (err) throw new Error(err.message);
      setSettings(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSettings = async (updates: UpdateStoreSettings): Promise<StoreSettings> => {
    if (settings) {
      const { data, error: err } = await supabase
        .from("store_settings")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", settings.id)
        .select()
        .single();
      if (err) throw new Error(err.message);
      setSettings(data);
      return data;
    } else {
      const { data, error: err } = await supabase
        .from("store_settings")
        .insert({ name: updates.name ?? "Toko Saya", ...updates })
        .select()
        .single();
      if (err) throw new Error(err.message);
      setSettings(data);
      return data;
    }
  };

  useEffect(() => {
    if (user) fetchSettings();
  }, [fetchSettings, user]);

  return { settings, loading, error, fetchSettings, updateSettings };
}
