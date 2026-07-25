import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/react-app/lib/supabase";
import { useAuth } from "@/react-app/App";
import type { PaymentGatewaySettings } from "@/shared/types";

export function usePaymentGateway() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<PaymentGatewaySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("payment_gateway_settings")
        .select("*")
        .maybeSingle();
      if (err) throw new Error(err.message);
      if (data) {
        setSettings({
          id: data.id,
          has_pin: !!data.pin_hash,
          doku_client_id: data.doku_client_id,
          doku_secret_key: data.doku_secret_key,
          doku_environment: data.doku_environment,
          created_at: data.created_at,
          updated_at: data.updated_at,
        });
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSettings = async (updates: any): Promise<void> => {
    if (settings) {
      const { error: err } = await supabase
        .from("payment_gateway_settings")
        .update({
          doku_client_id: updates.doku_client_id,
          doku_secret_key: updates.doku_secret_key,
          doku_environment: updates.doku_environment,
          updated_at: new Date().toISOString(),
        })
        .eq("id", settings.id);
      if (err) throw new Error(err.message);
    } else {
      const { error: err } = await supabase
        .from("payment_gateway_settings")
        .insert({
          doku_client_id: updates.doku_client_id,
          doku_secret_key: updates.doku_secret_key,
          doku_environment: updates.doku_environment,
        });
      if (err) throw new Error(err.message);
    }
    await fetchSettings();
  };

  useEffect(() => {
    if (user) fetchSettings();
  }, [fetchSettings, user]);

  return { settings, loading, error, fetchSettings, updateSettings };
}
