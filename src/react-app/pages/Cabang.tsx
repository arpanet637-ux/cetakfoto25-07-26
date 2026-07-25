import { useState } from "react";
import MainLayout from "@/react-app/components/layout/MainLayout";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Label } from "@/react-app/components/ui/label";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Loader2, 
  Building2, 
  X, 
  MapPin, 
  Phone,
  Save
} from "lucide-react";
import { useBranches } from "@/react-app/hooks/useBranches";
import type { Branch } from "@/shared/types";

interface BranchFormData {
  name: string;
  address: string;
  phone: string;
}

export default function CabangPage() {
  const { branches, loading, createBranch, updateBranch, deleteBranch } = useBranches();
  const [showForm, setShowForm] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [formData, setFormData] = useState<BranchFormData>({
    name: "",
    address: "",
    phone: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const resetForm = () => {
    setFormData({ name: "", address: "", phone: "" });
    setEditingBranch(null);
    setShowForm(false);
    setError("");
  };

  const handleEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      address: branch.address || "",
      phone: branch.phone || "",
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.name.trim()) {
      setError("Nama cabang harus diisi");
      return;
    }

    try {
      setSaving(true);
      if (editingBranch) {
        await updateBranch(editingBranch.id, {
          name: formData.name,
          address: formData.address || null,
          phone: formData.phone || null,
        });
      } else {
        await createBranch({
          name: formData.name,
          address: formData.address || null,
          phone: formData.phone || null,
        });
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (branch: Branch) => {
    if (!confirm(`Yakin ingin menghapus cabang "${branch.name}"?`)) return;
    try {
      await deleteBranch(branch.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal menghapus cabang");
    }
  };

  if (loading) {
    return (
      <MainLayout title="Cabang" subtitle="Kelola cabang toko Anda">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Cabang" subtitle="Kelola cabang toko Anda">
      <div className="mx-auto max-w-2xl">
        {/* Add Button */}
        {!showForm && (
          <Button onClick={() => setShowForm(true)} className="mb-6">
            <Plus className="mr-2 h-4 w-4" />
            Tambah Cabang
          </Button>
        )}

        {/* Form */}
        {showForm && (
          <div className="mb-6 rounded-xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                {editingBranch ? "Edit Cabang" : "Tambah Cabang Baru"}
              </h2>
              <Button variant="ghost" size="icon" onClick={resetForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Nama Cabang <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Contoh: Cabang Pusat, Cabang Timur"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Alamat
                </Label>
                <Input
                  id="address"
                  placeholder="Alamat cabang (opsional)"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  No. Telepon
                </Label>
                <Input
                  id="phone"
                  placeholder="08123456789 (opsional)"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      {editingBranch ? "Simpan Perubahan" : "Tambah Cabang"}
                    </>
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Batal
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Branch List */}
        <div className="space-y-3">
          {branches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">Belum ada cabang</p>
              <p className="text-sm text-muted-foreground">
                Tambahkan cabang pertama Anda
              </p>
            </div>
          ) : (
            branches.map((branch) => (
              <div
                key={branch.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{branch.name}</p>
                    <div className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                      {branch.address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {branch.address}
                        </span>
                      )}
                      {branch.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {branch.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(branch)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(branch)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </MainLayout>
  );
}
