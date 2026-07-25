import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/react-app/components/ui/dialog";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Label } from "@/react-app/components/ui/label";
import { Plus, Trash2, Search, Package } from "lucide-react";
import type { OrderWithItems, OrderItem, Product } from "@/shared/types";

interface EditOrderItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderWithItems;
  products: Product[];
  onAddItem: (item: {
    product_id?: number;
    product_name: string;
    quantity: number;
    unit_price: number;
    discount: number;
    method: "cetak_sendiri" | "tim_produksi";
    deadline_date: string;
  }) => Promise<void>;
  onUpdateItem: (itemId: number, data: Partial<OrderItem>) => Promise<void>;
  onDeleteItem: (itemId: number) => Promise<void>;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
};

export default function EditOrderItemsModal({
  isOpen,
  onClose,
  order,
  products,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
}: EditOrderItemsModalProps) {
  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ quantity: 1, discount: 0, deadline_date: "" });
  const [loading, setLoading] = useState(false);

  // New item form
  const [newItem, setNewItem] = useState<{
    product: Product | null;
    quantity: number;
    discount: number;
    deadline_date: string;
  }>({
    product: null,
    quantity: 1,
    discount: 0,
    deadline_date: new Date().toISOString().split("T")[0],
  });

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  useEffect(() => {
    if (!isOpen) {
      setProductSearch("");
      setShowProductDropdown(false);
      setEditingItem(null);
      setNewItem({
        product: null,
        quantity: 1,
        discount: 0,
        deadline_date: new Date().toISOString().split("T")[0],
      });
    }
  }, [isOpen]);

  const handleSelectProduct = (product: Product) => {
    setNewItem({
      product,
      quantity: 1,
      discount: 0,
      deadline_date: new Date().toISOString().split("T")[0],
    });
    setProductSearch(product.name);
    setShowProductDropdown(false);
  };

  const handleAddItem = async () => {
    if (!newItem.product) return;
    setLoading(true);
    try {
      await onAddItem({
        product_id: newItem.product.id,
        product_name: newItem.product.name,
        quantity: newItem.quantity,
        unit_price: newItem.product.price,
        discount: newItem.discount,
        method: newItem.product.default_method,
        deadline_date: newItem.deadline_date,
      });
      setNewItem({
        product: null,
        quantity: 1,
        discount: 0,
        deadline_date: new Date().toISOString().split("T")[0],
      });
      setProductSearch("");
    } finally {
      setLoading(false);
    }
  };

  const startEditItem = (item: OrderItem) => {
    setEditingItem(item.id);
    setEditForm({
      quantity: item.quantity,
      discount: item.discount,
      deadline_date: item.deadline_date.split("T")[0],
    });
  };

  const handleSaveItem = async (item: OrderItem) => {
    setLoading(true);
    try {
      const subtotal = editForm.quantity * item.unit_price - editForm.discount;
      await onUpdateItem(item.id, {
        quantity: editForm.quantity,
        discount: editForm.discount,
        deadline_date: editForm.deadline_date,
        subtotal,
      });
      setEditingItem(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!confirm("Hapus item ini dari pesanan?")) return;
    setLoading(true);
    try {
      await onDeleteItem(itemId);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Kelola Item Pesanan</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {/* Add New Product Section */}
          <div className="rounded-lg border border-border p-4 bg-muted/30">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Tambah Produk Baru
            </h4>
            
            <div className="space-y-3">
              <div className="relative">
                <Label className="text-sm">Cari Produk</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setShowProductDropdown(true);
                      if (newItem.product && e.target.value !== newItem.product.name) {
                        setNewItem({ ...newItem, product: null });
                      }
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                    placeholder="Ketik nama produk..."
                    className="pl-9"
                  />
                </div>
                
                {showProductDropdown && productSearch && (
                  <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {filteredProducts.length > 0 ? (
                      filteredProducts.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-muted flex items-center justify-between"
                          onClick={() => handleSelectProduct(product)}
                        >
                          <span>{product.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {formatCurrency(product.price)}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-muted-foreground text-sm">
                        Produk tidak ditemukan
                      </div>
                    )}
                  </div>
                )}
              </div>

              {newItem.product && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-sm">Jumlah</Label>
                    <Input
                      type="number"
                      min="1"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) || 1 })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Diskon</Label>
                    <Input
                      type="number"
                      min="0"
                      value={newItem.discount}
                      onChange={(e) => setNewItem({ ...newItem, discount: Number(e.target.value) || 0 })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Deadline</Label>
                    <Input
                      type="date"
                      value={newItem.deadline_date}
                      onChange={(e) => setNewItem({ ...newItem, deadline_date: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
              )}

              {newItem.product && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm">
                    Subtotal: <span className="font-semibold">
                      {formatCurrency(newItem.quantity * newItem.product.price - newItem.discount)}
                    </span>
                  </span>
                  <Button size="sm" onClick={handleAddItem} disabled={loading}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Tambah
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Existing Items List */}
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Item Pesanan ({(order.items || []).length})
            </h4>
            
            <div className="space-y-2">
              {(order.items || []).map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-border p-3 bg-card"
                >
                  {editingItem === item.id ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{item.product_name}</span>
                        <span className="text-sm text-muted-foreground">
                          @ {formatCurrency(item.unit_price)}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs">Jumlah</Label>
                          <Input
                            type="number"
                            min="1"
                            value={editForm.quantity}
                            onChange={(e) => setEditForm({ ...editForm, quantity: Number(e.target.value) || 1 })}
                            className="mt-1 h-9"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Diskon</Label>
                          <Input
                            type="number"
                            min="0"
                            value={editForm.discount}
                            onChange={(e) => setEditForm({ ...editForm, discount: Number(e.target.value) || 0 })}
                            className="mt-1 h-9"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Deadline</Label>
                          <Input
                            type="date"
                            value={editForm.deadline_date}
                            onChange={(e) => setEditForm({ ...editForm, deadline_date: e.target.value })}
                            className="mt-1 h-9"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditingItem(null)}>
                          Batal
                        </Button>
                        <Button size="sm" onClick={() => handleSaveItem(item)} disabled={loading}>
                          Simpan
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.product_name}</span>
                          <span className={`px-1.5 py-0.5 rounded text-xs ${
                            item.method === "cetak_sendiri"
                              ? "bg-teal-100 text-teal-700"
                              : "bg-purple-100 text-purple-700"
                          }`}>
                            {item.method === "cetak_sendiri" ? "Cetak" : "Tim"}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground mt-0.5">
                          {item.quantity}x @ {formatCurrency(item.unit_price)}
                          {item.discount > 0 && (
                            <span className="text-green-600 ml-2">-{formatCurrency(item.discount)}</span>
                          )}
                          <span className="ml-2 font-medium text-foreground">= {formatCurrency(item.subtotal)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Deadline: {new Date(item.deadline_date).toLocaleDateString("id-ID")}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEditItem(item)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteItem(item.id)}
                          disabled={loading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {(order.items || []).length === 0 && (
                <div className="text-center py-6 text-muted-foreground">
                  Belum ada item. Tambahkan produk di atas.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-border mt-4">
          <Button variant="outline" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
