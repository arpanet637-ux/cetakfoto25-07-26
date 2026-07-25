import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/react-app/components/ui/dialog";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Label } from "@/react-app/components/ui/label";
import { Check, Wallet, Banknote, CreditCard, Trash2 } from "lucide-react";
import type { OrderWithItems, PaymentRecord } from "@/shared/types";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderWithItems;
  onPaymentAdded?: () => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
};

export default function PaymentModal({
  isOpen,
  onClose,
  order,
  onPaymentAdded,
}: PaymentModalProps) {
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer">("cash");
  const [loading, setLoading] = useState(false);
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([]);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const totalAmount = order?.total_amount || 0;
  const currentPaid = order?.paid_amount || 0;
  const remaining = totalAmount - currentPaid;

  const fetchPaymentRecords = useCallback(async () => {
    if (!order?.id) return;
    try {
      const res = await fetch(`/api/payments/order/${order.id}`);
      if (res.ok) {
        const data = await res.json();
        setPaymentRecords(data);
      }
    } catch (err) {
      console.error("Failed to fetch payment records:", err);
    }
  }, [order?.id]);

  useEffect(() => {
    if (isOpen && order?.id) {
      setPaymentAmount("");
      setPaymentMethod("cash");
      fetchPaymentRecords();
    }
  }, [isOpen, order?.id, fetchPaymentRecords]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(paymentAmount);
    if (amount <= 0) return;
    
    setLoading(true);
    try {
      // Determine payment type based on whether this payment completes the order
      // If paid + amount >= total, it's "pelunasan" (full payment), otherwise "dp"
      const willBePaidInFull = (currentPaid + amount) >= totalAmount;
      const paymentType = willBePaidInFull ? "pelunasan" : "dp";
      
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: order.id,
          amount,
          payment_method: paymentMethod,
          payment_type: paymentType,
        }),
      });
      
      if (res.ok) {
        await fetchPaymentRecords();
        setPaymentAmount("");
        onPaymentAdded?.();
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePayFull = async () => {
    if (remaining <= 0) return;
    setLoading(true);
    try {
      // Paying full remaining = always pelunasan
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: order.id,
          amount: remaining,
          payment_method: paymentMethod,
          payment_type: "pelunasan",
        }),
      });
      
      if (res.ok) {
        await fetchPaymentRecords();
        onPaymentAdded?.();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    if (!confirm("Hapus pembayaran ini?")) return;
    setDeletingId(paymentId);
    try {
      const res = await fetch(`/api/payments/${paymentId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchPaymentRecords();
        onPaymentAdded?.();
      }
    } finally {
      setDeletingId(null);
    }
  };

  const getPaymentStatus = () => {
    if (currentPaid >= totalAmount) {
      return { label: "LUNAS", color: "bg-green-100 text-green-700" };
    } else if (currentPaid > 0) {
      return { label: "DP", color: "bg-yellow-100 text-yellow-700" };
    }
    return { label: "Belum Bayar", color: "bg-red-100 text-red-700" };
  };

  const status = getPaymentStatus();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Status Pembayaran
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Payment Summary */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Pesanan</span>
              <span className="font-semibold">{formatCurrency(totalAmount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Sudah Dibayar</span>
              <span className="font-semibold text-green-600">{formatCurrency(currentPaid)}</span>
            </div>
            <div className="border-t border-border pt-3 flex items-center justify-between">
              <span className="text-sm font-medium">Sisa Pembayaran</span>
              <span className="font-bold text-lg">{formatCurrency(remaining)}</span>
            </div>
            <div className="flex justify-center pt-1">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${status.color}`}>
                {status.label}
              </span>
            </div>
          </div>

          {/* Payment History */}
          {paymentRecords.length > 0 && (
            <div className="rounded-lg border border-border p-3 space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Riwayat Pembayaran</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {paymentRecords.map((record) => (
                  <div key={record.id} className="flex items-center justify-between text-sm bg-muted/30 rounded px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        record.payment_method === "cash" 
                          ? "bg-emerald-100 text-emerald-700" 
                          : "bg-blue-100 text-blue-700"
                      }`}>
                        {record.payment_method === "cash" ? "Cash" : "Transfer"}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        record.payment_type === "dp" 
                          ? "bg-yellow-100 text-yellow-700" 
                          : "bg-green-100 text-green-700"
                      }`}>
                        {record.payment_type === "dp" ? "DP" : "Pelunasan"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{formatCurrency(record.amount)}</span>
                      <button
                        onClick={() => handleDeletePayment(record.id)}
                        disabled={deletingId === record.id}
                        className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {remaining > 0 ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Payment Method Selection */}
              <div>
                <Label className="mb-2 block">Metode Pembayaran</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("cash")}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                      paymentMethod === "cash"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-muted-foreground/50"
                    }`}
                  >
                    <Banknote className="h-5 w-5" />
                    <span className="font-medium">Cash</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("transfer")}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                      paymentMethod === "transfer"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-muted-foreground/50"
                    }`}
                  >
                    <CreditCard className="h-5 w-5" />
                    <span className="font-medium">Transfer</span>
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="payment_amount">Tambah Pembayaran</Label>
                <Input
                  id="payment_amount"
                  type="number"
                  min="1"
                  max={remaining}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Masukkan nominal"
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Bisa bayar DP atau sebagian dari sisa pembayaran
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  type="submit"
                  disabled={loading || !paymentAmount || Number(paymentAmount) <= 0}
                  className="w-full"
                >
                  Tambah Pembayaran {paymentAmount ? formatCurrency(Number(paymentAmount)) : ""}
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePayFull}
                  disabled={loading}
                  className="w-full"
                >
                  <Check className="mr-2 h-4 w-4" />
                  Bayar Lunas ({formatCurrency(remaining)})
                </Button>
              </div>
            </form>
          ) : (
            <div className="text-center py-4">
              <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-full bg-green-100 mb-3">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <p className="font-medium text-green-700">Pembayaran sudah lunas!</p>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={onClose}>
              Tutup
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
