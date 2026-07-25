import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@getmocha/users-service/react";

interface PaymentGatewayInfo {
  has_pin: boolean;
  doku_client_id: string | null;
  doku_secret_key: string | null;
  doku_environment: "sandbox" | "production";
}

interface DecryptedSettings {
  verified: boolean;
  doku_client_id: string;
  doku_secret_key: string;
  doku_environment: "sandbox" | "production";
}

export function usePaymentGateway() {
  const { user } = useAuth();
  const [info, setInfo] = useState<PaymentGatewayInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInfo = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/payment-gateway", { credentials: "include" });
      if (!res.ok) throw new Error("Gagal mengambil data");
      const data = await res.json();
      setInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchInfo();
    }
  }, [user, fetchInfo]);

  const setPin = async (pin: string) => {
    const res = await fetch("/api/payment-gateway/set-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ pin }),
    });
    
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Gagal mengatur PIN");
    }
    
    await fetchInfo();
    return true;
  };

  const verifyPin = async (pin: string): Promise<DecryptedSettings | null> => {
    const res = await fetch("/api/payment-gateway/verify-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ pin }),
    });
    
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "PIN salah");
    }
    
    return res.json();
  };

  const updateSettings = async (data: {
    pin: string;
    doku_client_id?: string | null;
    doku_secret_key?: string | null;
    doku_environment?: "sandbox" | "production" | null;
  }) => {
    const res = await fetch("/api/payment-gateway", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });
    
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Gagal menyimpan pengaturan");
    }
    
    await fetchInfo();
    return true;
  };

  return {
    info,
    loading,
    error,
    setPin,
    verifyPin,
    updateSettings,
    refetch: fetchInfo,
  };
}
