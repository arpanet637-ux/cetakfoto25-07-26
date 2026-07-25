import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Label } from "@/react-app/components/ui/label";
import type { Expense } from "@/react-app/hooks/useExpenses";

interface ExpenseFormModalProps {
  expense?: Expense | null;
  onClose: () => void;
  onSave: (data: Omit<Expense, "id" | "created_at" | "updated_at">) => Promise<void>;
}

export default function ExpenseFormModal({
  expense,
  onClose,
  onSave,
}: ExpenseFormModalProps) {
  const [formData, setFormData] = useState({
    expense_type: "operasional",
    description: "",
    amount: "",
    expense_date: new Date().toISOString().split("T")[0],
    vendor_name: "",
    order_id: null as number | null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (expense) {
      setFormData({
        expense_type: expense.expense_type,
        description: expense.description,
        amount: expense.amount.toString(),
        expense_date: expense.expense_date,
        vendor_name: expense.vendor_name || "",
        order_id: expense.order_id,
      });
    }
  }, [expense]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.description.trim()) {
      setError("Deskripsi harus diisi");
      return;
    }

    if (!formData.amount || Number(formData.amount) <= 0) {
      setError("Jumlah harus lebih dari 0");
      return;
    }

    try {
      setSaving(true);
      await onSave({
        expense_type: formData.expense_type,
        description: formData.description,
        amount: Number(formData.amount),
        expense_date: formData.expense_date,
        vendor_name: formData.vendor_name || null,
        order_id: formData.order_id,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            {expense ? "Edit Pengeluaran" : "Tambah Pengeluaran"}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Expense Type */}
          <div>
            <Label>Jenis Pengeluaran</Label>
            <div className="mt-2 flex gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="expense_type"
                  value="operasional"
                  checked={formData.expense_type === "operasional"}
                  onChange={(e) =>
                    setFormData({ ...formData, expense_type: e.target.value })
                  }
                  className="h-4 w-4 text-primary"
                />
                <span className="text-sm">Operasional</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="expense_type"
                  value="vendor"
                  checked={formData.expense_type === "vendor"}
                  onChange={(e) =>
                    setFormData({ ...formData, expense_type: e.target.value })
                  }
                  className="h-4 w-4 text-primary"
                />
                <span className="text-sm">Vendor/Tim Produksi</span>
              </label>
            </div>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Deskripsi</Label>
            <Input
              id="description"
              placeholder="Contoh: Beli tinta printer"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
          </div>

          {/* Amount */}
          <div>
            <Label htmlFor="amount">Jumlah (Rp)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="0"
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: e.target.value })
              }
            />
          </div>

          {/* Date */}
          <div>
            <Label htmlFor="expense_date">Tanggal</Label>
            <Input
              id="expense_date"
              type="date"
              value={formData.expense_date}
              onChange={(e) =>
                setFormData({ ...formData, expense_date: e.target.value })
              }
            />
          </div>

          {/* Vendor Name (optional) */}
          {formData.expense_type === "vendor" && (
            <div>
              <Label htmlFor="vendor_name">Nama Vendor (opsional)</Label>
              <Input
                id="vendor_name"
                placeholder="Nama vendor atau tim produksi"
                value={formData.vendor_name}
                onChange={(e) =>
                  setFormData({ ...formData, vendor_name: e.target.value })
                }
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              Batal
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
