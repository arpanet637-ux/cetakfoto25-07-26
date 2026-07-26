import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/react-app/components/ui/dialog";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Label } from "@/react-app/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/react-app/components/ui/select";
import { Plus, Trash2, Search, Package } from "lucide-react";
import type { Product, Branch } from "@/shared/types";

interface OrderItem {
  product_id?: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount: number;
  method: "cetak_sendiri" | "tim_produksi";
  deadline_date: string;
}

interface OrderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    client_name: string;
    client_phone?: string;
    notes?: string;
    discount?: number;
    branch_id?: number;
    items: OrderItem[];
  }) => Promise<void>;
  products: Product[];
  branches: Branch[];
}

export default function OrderFormModal({
  isOpen,
  onClose,
  onSubmit,
  products,
  branches,
}: OrderFormModalProps) {
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [branchId, setBranchId] = useState<number | undefined>(undefined);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [overallDiscount, setOverallDiscount] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Product search
  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const search = productSearch.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(search));
  }, [products, productSearch]);

  useEffect(() => {
    if (isOpen) {
      setClientName("");
      setClientPhone("");
      setNotes("");
      setBranchId(undefined);
      setItems([]);
      setOverallDiscount(0);
      setProductSearch("");
      setShowProductDropdown(false);
    }
  }, [isOpen]);

  const handleProductSelect = (product: Product) => {
    // Ensure price is a clean number
    const priceValue = product.price as any;
    const productPrice = typeof priceValue === "string"
      ? parseInt(priceValue.replace(/[^0-9]/g, ""), 10)
      : Number(priceValue) || 0;
    
    // Guard against missing prices
    if (!productPrice || productPrice <= 0) {
      alert(`⚠️ Produk "${product.name}" tidak memiliki harga yang valid. Hubungi administrator.`);
      return;
    }

    const newItem: OrderItem = {
      product_id: product.id,
      product_name: product.name,
      quantity: 1,
      unit_price: productPrice,
      discount: 0,
      method: product.default_method,
      deadline_date: new Date().toISOString().split("T")[0],
    };
    setItems([...items, newItem]);
    setProductSearch("");
    setShowProductDropdown(false);
  };

  const updateItem = (index: number, field: keyof OrderItem, value: unknown) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateSubtotal = (item: OrderItem) => {
    return item.quantity * item.unit_price - item.discount;
  };

  const subtotalAmount = items.reduce((sum, item) => sum + calculateSubtotal(item), 0);
  const totalAmount = subtotalAmount - overallDiscount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || items.length === 0) {
      return;
    }

    // Validate all items have proper prices before saving
    const invalidItems = items.filter(
      (item) =>
        item.unit_price === undefined ||
        item.unit_price === null ||
        typeof item.unit_price !== "number" ||
        item.unit_price <= 0
    );

    if (invalidItems.length > 0) {
      alert(
        `❌ Terdapat ${invalidItems.length} item dengan harga tidak valid:\n` +
        invalidItems.map((item) => `• ${item.product_name}`).join("\n") +
        "\n\nHarap periksa harga setiap item sebelum menyimpan."
      );
      return;
    }

    // Ensure all prices are clean numbers in the payload
    const cleanItems = items.map((item) => ({
      ...item,
      unit_price: Number(item.unit_price),
      quantity: Number(item.quantity),
      discount: Number(item.discount),
    }));

    setLoading(true);
    try {
      await onSubmit({
        client_name: clientName,
        client_phone: clientPhone || undefined,
        notes: notes || undefined,
        discount: overallDiscount,
        branch_id: branchId,
        items: cleanItems,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buat Pesanan Baru</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Client Info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="client_name">Nama Klien *</Label>
              <Input
                id="client_name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Nama klien"
                required
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="client_phone">No. Telepon</Label>
              <Input
                id="client_phone"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="08xxxxxxxxxx"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="branch">Cabang</Label>
              <Select
                value={branchId?.toString() || ""}
                onValueChange={(val) => setBranchId(val ? Number(val) : undefined)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Pilih cabang (opsional)" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id.toString()}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="notes">Catatan</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan tambahan (opsional)"
                className="mt-1.5"
              />
            </div>
          </div>

          {/* Product Search */}
          <div>
            <Label className="text-base font-semibold">Tambah Produk</Label>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari produk..."
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value);
                  setShowProductDropdown(true);
                }}
                onFocus={() => setShowProductDropdown(true)}
                className="pl-10"
              />
              
              {/* Product Dropdown */}
              {showProductDropdown && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
                  {filteredProducts.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Tidak ada produk ditemukan
                    </div>
                  ) : (
                    filteredProducts.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleProductSelect(product)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Package className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-foreground">{product.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatCurrency(product.price)} • {product.default_method === "cetak_sendiri" ? "Cetak Sendiri" : "Tim Produksi"}
                          </div>
                        </div>
                        <Plus className="h-5 w-5 text-muted-foreground" />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            
            {/* Click outside to close */}
            {showProductDropdown && (
              <div
                className="fixed inset-0 z-0"
                onClick={() => setShowProductDropdown(false)}
              />
            )}
          </div>

          {/* Order Items */}
          {items.length > 0 && (
            <div>
              <Label className="text-base font-semibold">Item Pesanan ({items.length})</Label>
              <div className="mt-3 space-y-3">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-border bg-muted/30 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{item.product_name}</span>
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-medium ${
                              item.method === "cetak_sendiri"
                                ? "bg-teal-100 text-teal-700"
                                : "bg-purple-100 text-purple-700"
                            }`}
                          >
                            {item.method === "cetak_sendiri" ? "Cetak Sendiri" : "Tim Produksi"}
                          </span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-4">
                      <div>
                        <Label className="text-xs">Jumlah</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(index, "quantity", Number(e.target.value) || 1)
                          }
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Harga Satuan</Label>
                        <Input
                          type="number"
                          min="0"
                          value={item.unit_price}
                          onChange={(e) =>
                            updateItem(index, "unit_price", Number(e.target.value) || 0)
                          }
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Diskon (Rp)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={item.discount}
                          onChange={(e) =>
                            updateItem(index, "discount", Number(e.target.value) || 0)
                          }
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Deadline</Label>
                        <Input
                          type="date"
                          value={item.deadline_date}
                          onChange={(e) =>
                            updateItem(index, "deadline_date", e.target.value)
                          }
                          className="mt-1"
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex justify-end">
                      <div className="rounded-md bg-muted px-3 py-1.5 text-sm">
                        Subtotal: <span className="font-semibold">{formatCurrency(calculateSubtotal(item))}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {items.length === 0 && (
            <div className="rounded-lg border-2 border-dashed border-border py-8 text-center">
              <Package className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                Cari dan pilih produk untuk ditambahkan ke pesanan
              </p>
            </div>
          )}

          {/* Overall Discount and Total */}
          {items.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex-1">
                  <Label htmlFor="overall_discount" className="text-sm font-medium">Diskon Keseluruhan (Rp)</Label>
                  <Input
                    id="overall_discount"
                    type="number"
                    min="0"
                    value={overallDiscount}
                    onChange={(e) => setOverallDiscount(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="mt-1.5"
                  />
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Subtotal</div>
                  <div className="font-medium">{formatCurrency(subtotalAmount)}</div>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-primary/10 px-4 py-3">
                <span className="text-lg font-semibold">Total</span>
                <span className="text-xl font-bold text-primary">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={loading || items.length === 0}>
              {loading ? "Menyimpan..." : "Simpan Pesanan"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
