import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/react-app/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/react-app/components/ui/select";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Label } from "@/react-app/components/ui/label";
import type { OrderWithItems, Branch } from "@/shared/types";

interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderWithItems;
  branches: Branch[];
  onSubmit: (data: {
    client_name: string;
    client_phone?: string;
    notes?: string;
    discount?: number;
    branch_id?: number | null;
  }) => Promise<void>;
}

export default function EditOrderModal({
  isOpen,
  onClose,
  order,
  branches,
  onSubmit,
}: EditOrderModalProps) {
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState(0);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && order) {
      setClientName(order.client_name || "");
      setClientPhone(order.client_phone || "");
      setNotes(order.notes || "");
      setDiscount(order.discount || 0);
      setBranchId(order.branch_id || null);
    }
  }, [isOpen, order]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;
    
    setLoading(true);
    try {
      await onSubmit({
        client_name: clientName,
        client_phone: clientPhone || undefined,
        notes: notes || undefined,
        discount: discount,
        branch_id: branchId,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Pesanan</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="edit_client_name">Nama Klien *</Label>
            <Input
              id="edit_client_name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nama klien"
              required
              className="mt-1.5"
            />
          </div>
          
          <div>
            <Label htmlFor="edit_client_phone">No. Telepon</Label>
            <Input
              id="edit_client_phone"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="08xxxxxxxxxx"
              className="mt-1.5"
            />
          </div>
          
          <div>
            <Label htmlFor="edit_notes">Catatan</Label>
            <Input
              id="edit_notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan tambahan"
              className="mt-1.5"
            />
          </div>
          
          <div>
            <Label htmlFor="edit_discount">Diskon Keseluruhan (Rp)</Label>
            <Input
              id="edit_discount"
              type="number"
              min="0"
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value) || 0)}
              placeholder="0"
              className="mt-1.5"
            />
          </div>

          {branches.length > 0 && (
            <div>
              <Label>Cabang</Label>
              <Select
                value={branchId?.toString() || "none"}
                onValueChange={(val) => setBranchId(val === "none" ? null : Number(val))}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Pilih cabang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tanpa Cabang</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id.toString()}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
