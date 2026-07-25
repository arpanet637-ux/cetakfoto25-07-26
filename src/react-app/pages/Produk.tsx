import { useState, useMemo, useRef } from "react";
import MainLayout from "@/react-app/components/layout/MainLayout";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { useProducts } from "@/react-app/hooks/useProducts";
import { supabase } from "@/react-app/lib/supabase";
import ProductFormModal from "@/react-app/components/produk/ProductFormModal";
import DeleteConfirmModal from "@/react-app/components/shared/DeleteConfirmModal";
import type { Product, CreateProduct } from "@/shared/types";
import {
  Plus,
  Search,
  Package,
  Pencil,
  Trash2,
  AlertTriangle,
  Printer,
  Users,
  Download,
  Upload,
  Loader2,
} from "lucide-react";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function ProdukPage() {
  const { products, loading, fetchProducts, createProduct, updateProduct, deleteProduct } = useProducts();
  
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  const handleAddClick = () => {
    setEditingProduct(null);
    setFormOpen(true);
  };

  const handleEditClick = (product: Product) => {
    setEditingProduct(product);
    setFormOpen(true);
  };

  const handleSubmit = async (data: CreateProduct) => {
    if (editingProduct) {
      await updateProduct(editingProduct.id, data);
    } else {
      await createProduct(data);
    }
  };

  const handleDelete = async () => {
    if (deleteTarget) {
      await deleteProduct(deleteTarget.id);
    }
  };

  const handleExport = async () => {
    try {
      const { data } = await supabase.from("products").select("*");
      const blob = new Blob([JSON.stringify(data ?? [], null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `bisnisKu_produk_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const products = Array.isArray(data) ? data : (data.products ?? []);

      let imported = 0;
      let skipped = 0;
      for (const product of products) {
        const { id, created_at, updated_at, user_id, ...productData } = product;
        const { error } = await supabase.from("products").insert(productData);
        if (error) { skipped++; } else { imported++; }
      }

      setImportResult({
        success: true,
        message: `Berhasil import ${imported} produk${skipped > 0 ? `, ${skipped} dilewati` : ""}.`,
      });
      fetchProducts();
    } catch {
      setImportResult({
        success: false,
        message: "File tidak valid. Pastikan file adalah backup produk BisnisKu.",
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <MainLayout title="Produk" subtitle="Kelola daftar produk Anda">
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Import result notification */}
      {importResult && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 text-sm ${
            importResult.success
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {importResult.message}
          <button
            className="ml-2 font-medium underline"
            onClick={() => setImportResult(null)}
          >
            Tutup
          </button>
        </div>
      )}

      {/* Header Actions */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari produk..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExport} disabled={products.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" onClick={handleImportClick} disabled={importing}>
            {importing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Import
          </Button>
          <Button onClick={handleAddClick}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Produk
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {/* Empty State */}
      {!loading && products.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Package className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-foreground">
            Belum ada produk
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Mulai dengan menambahkan produk pertama Anda
          </p>
          <Button className="mt-6" onClick={handleAddClick}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Produk
          </Button>
        </div>
      )}

      {/* No Search Results */}
      {!loading && products.length > 0 && filteredProducts.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border py-12">
          <Search className="h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-muted-foreground">
            Tidak ada produk dengan kata kunci "{search}"
          </p>
        </div>
      )}

      {/* Products Table */}
      {!loading && filteredProducts.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Produk
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Harga
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Stok
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Metode
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredProducts.map((product) => {
                const isLowStock = product.stock <= product.min_stock;
                return (
                  <tr
                    key={product.id}
                    className="transition-colors hover:bg-muted/20"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Package className="h-5 w-5 text-primary" />
                        </div>
                        <span className="font-medium text-foreground">
                          {product.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {formatCurrency(product.price)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <span
                          className={`font-medium ${
                            isLowStock ? "text-destructive" : "text-foreground"
                          }`}
                        >
                          {product.stock}
                        </span>
                        {isLowStock && (
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                      <p className="text-center text-xs text-muted-foreground">
                        Min: {product.min_stock}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      {product.default_method === "cetak_sendiri" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                          <Printer className="h-3 w-3" />
                          Cetak Sendiri
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700">
                          <Users className="h-3 w-3" />
                          Tim Produksi
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditClick(product)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(product)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary Stats */}
      {!loading && products.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-4">
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Total Produk</p>
            <p className="text-xl font-bold text-foreground">{products.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Stok Rendah</p>
            <p className="text-xl font-bold text-destructive">
              {products.filter((p) => p.stock <= p.min_stock).length}
            </p>
          </div>
        </div>
      )}

      {/* Form Modal */}
      <ProductFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editingProduct}
        onSubmit={handleSubmit}
      />

      {/* Delete Confirm Modal */}
      <DeleteConfirmModal
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Hapus Produk?"
        description={`Produk "${deleteTarget?.name}" akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.`}
        onConfirm={handleDelete}
      />
    </MainLayout>
  );
}
