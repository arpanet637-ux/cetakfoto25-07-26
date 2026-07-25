import { useState, useEffect } from "react";
import MainLayout from "@/react-app/components/layout/MainLayout";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Label } from "@/react-app/components/ui/label";
import { Textarea } from "@/react-app/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/react-app/components/ui/select";
import { Save, Store, Loader2, Check, Instagram, Facebook, Phone, Mail, MapPin, CreditCard, Lock, Eye, EyeOff, KeyRound, Shield, Percent } from "lucide-react";
import { useStoreSettings } from "@/react-app/hooks/useStoreSettings";
import { usePaymentGateway } from "@/react-app/hooks/usePaymentGateway";

export default function PengaturanPage() {
  const { settings, loading, updateSettings } = useStoreSettings();
  const { info: pgInfo, loading: pgLoading, setPin, verifyPin, updateSettings: updatePgSettings } = usePaymentGateway();
  
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    instagram: "",
    facebook: "",
    admin_fee_qris: "",
    admin_fee_va: "",
    admin_fee_ewallet: "",
    admin_fee_cc: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Payment Gateway states
  const [pinInput, setPinInput] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinError, setPinError] = useState("");
  const [pgSaving, setPgSaving] = useState(false);
  const [pgSaved, setPgSaved] = useState(false);
  const [showClientId, setShowClientId] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  
  const [pgFormData, setPgFormData] = useState({
    doku_client_id: "",
    doku_secret_key: "",
    doku_environment: "sandbox" as "sandbox" | "production",
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        name: settings.name || "",
        address: settings.address || "",
        phone: settings.phone || "",
        email: settings.email || "",
        instagram: settings.instagram || "",
        facebook: settings.facebook || "",
        admin_fee_qris: settings.admin_fee_qris?.toString() || "",
        admin_fee_va: settings.admin_fee_va?.toString() || "",
        admin_fee_ewallet: settings.admin_fee_ewallet?.toString() || "",
        admin_fee_cc: settings.admin_fee_cc?.toString() || "",
      });
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaved(false);

    if (!formData.name.trim()) {
      setError("Nama toko harus diisi");
      return;
    }

    try {
      setSaving(true);
      await updateSettings({
        name: formData.name,
        address: formData.address || null,
        phone: formData.phone || null,
        email: formData.email || null,
        instagram: formData.instagram || null,
        facebook: formData.facebook || null,
        admin_fee_qris: formData.admin_fee_qris ? parseFloat(formData.admin_fee_qris) : null,
        admin_fee_va: formData.admin_fee_va ? parseFloat(formData.admin_fee_va) : null,
        admin_fee_ewallet: formData.admin_fee_ewallet ? parseFloat(formData.admin_fee_ewallet) : null,
        admin_fee_cc: formData.admin_fee_cc ? parseFloat(formData.admin_fee_cc) : null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan pengaturan");
    } finally {
      setSaving(false);
    }
  };

  // Handle set PIN
  const handleSetPin = async () => {
    setPinError("");
    if (newPin.length < 4 || newPin.length > 6) {
      setPinError("PIN harus 4-6 digit");
      return;
    }
    if (newPin !== confirmPin) {
      setPinError("Konfirmasi PIN tidak cocok");
      return;
    }
    if (!/^\d+$/.test(newPin)) {
      setPinError("PIN harus berupa angka");
      return;
    }

    try {
      setPgSaving(true);
      await setPin(newPin);
      setNewPin("");
      setConfirmPin("");
      setPgSaved(true);
      setTimeout(() => setPgSaved(false), 3000);
    } catch (err) {
      setPinError(err instanceof Error ? err.message : "Gagal mengatur PIN");
    } finally {
      setPgSaving(false);
    }
  };

  // Handle verify PIN
  const handleVerifyPin = async () => {
    setPinError("");
    try {
      const result = await verifyPin(pinInput);
      if (result?.verified) {
        setIsUnlocked(true);
        setPgFormData({
          doku_client_id: result.doku_client_id || "",
          doku_secret_key: result.doku_secret_key || "",
          doku_environment: result.doku_environment || "sandbox",
        });
        setPinInput("");
      }
    } catch (err) {
      setPinError(err instanceof Error ? err.message : "PIN salah");
    }
  };

  // Handle save payment gateway settings
  const handleSavePgSettings = async () => {
    setPinError("");
    try {
      setPgSaving(true);
      // Need to re-enter PIN for security
      const pin = prompt("Masukkan PIN untuk menyimpan:");
      if (!pin) return;
      
      await updatePgSettings({
        pin,
        doku_client_id: pgFormData.doku_client_id || null,
        doku_secret_key: pgFormData.doku_secret_key || null,
        doku_environment: pgFormData.doku_environment,
      });
      setPgSaved(true);
      setTimeout(() => setPgSaved(false), 3000);
    } catch (err) {
      setPinError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setPgSaving(false);
    }
  };

  if (loading) {
    return (
      <MainLayout title="Pengaturan" subtitle="Kelola profil toko Anda">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Pengaturan" subtitle="Kelola profil toko Anda">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Store Profile Form */}
        <form onSubmit={handleSubmit}>
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Store className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Profil Toko
                </h2>
                <p className="text-sm text-muted-foreground">
                  Informasi ini akan tampil di invoice
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Nama Toko <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Contoh: Percetakan Jaya Abadi"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Alamat
                </Label>
                <Textarea
                  id="address"
                  placeholder="Jl. Contoh No. 123, Kota, Provinsi"
                  rows={3}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    No. WhatsApp
                  </Label>
                  <Input
                    id="phone"
                    placeholder="08123456789"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="toko@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="instagram" className="flex items-center gap-2">
                    <Instagram className="h-4 w-4 text-muted-foreground" />
                    Instagram
                  </Label>
                  <Input
                    id="instagram"
                    placeholder="@namatoko"
                    value={formData.instagram}
                    onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="facebook" className="flex items-center gap-2">
                    <Facebook className="h-4 w-4 text-muted-foreground" />
                    Facebook
                  </Label>
                  <Input
                    id="facebook"
                    placeholder="Nama Toko"
                    value={formData.facebook}
                    onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
                  />
                </div>
              </div>

              {/* Admin Fee Section */}
              <div className="border-t border-border pt-5 mt-5">
                <div className="flex items-center gap-2 mb-4">
                  <Percent className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Biaya Admin DOKU (%)</Label>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Biaya admin akan ditampilkan di invoice untuk pembayaran via DOKU
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="admin_fee_qris">QRIS (%)</Label>
                    <Input
                      id="admin_fee_qris"
                      type="number"
                      step="0.01"
                      placeholder="0.7"
                      value={formData.admin_fee_qris}
                      onChange={(e) => setFormData({ ...formData, admin_fee_qris: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin_fee_va">Virtual Account (%)</Label>
                    <Input
                      id="admin_fee_va"
                      type="number"
                      step="0.01"
                      placeholder="1.5"
                      value={formData.admin_fee_va}
                      onChange={(e) => setFormData({ ...formData, admin_fee_va: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin_fee_ewallet">E-Wallet (%)</Label>
                    <Input
                      id="admin_fee_ewallet"
                      type="number"
                      step="0.01"
                      placeholder="1.5"
                      value={formData.admin_fee_ewallet}
                      onChange={(e) => setFormData({ ...formData, admin_fee_ewallet: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin_fee_cc">Kartu Kredit (%)</Label>
                    <Input
                      id="admin_fee_cc"
                      type="number"
                      step="0.01"
                      placeholder="2.9"
                      value={formData.admin_fee_cc}
                      onChange={(e) => setFormData({ ...formData, admin_fee_cc: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              {saved && (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                  <Check className="h-5 w-5" />
                  <span className="text-sm font-medium">Pengaturan berhasil disimpan!</span>
                </div>
              )}

              <div className="pt-2">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Simpan Pengaturan
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </form>

        {/* Payment Gateway Settings */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
              <CreditCard className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Payment Gateway (DOKU)
              </h2>
              <p className="text-sm text-muted-foreground">
                Kredensial terenkripsi & dilindungi PIN
              </p>
            </div>
          </div>

          {pgLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !pgInfo?.has_pin ? (
            // Set PIN for first time
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                <Shield className="h-5 w-5" />
                <span className="text-sm">Buat PIN untuk melindungi kredensial payment gateway</span>
              </div>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="newPin">PIN Baru (4-6 digit)</Label>
                  <Input
                    id="newPin"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="••••••"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPin">Konfirmasi PIN</Label>
                  <Input
                    id="confirmPin"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="••••••"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
              </div>

              {pinError && <p className="text-sm text-destructive">{pinError}</p>}
              {pgSaved && (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                  <Check className="h-5 w-5" />
                  <span className="text-sm font-medium">PIN berhasil diatur!</span>
                </div>
              )}

              <Button onClick={handleSetPin} disabled={pgSaving}>
                {pgSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="mr-2 h-4 w-4" />
                )}
                Buat PIN
              </Button>
            </div>
          ) : !isUnlocked ? (
            // Locked state - need PIN to unlock
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Masukkan PIN untuk mengakses pengaturan</span>
              </div>
              
              <div className="max-w-xs space-y-2">
                <Label htmlFor="pinInput">PIN</Label>
                <Input
                  id="pinInput"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="••••••"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyPin()}
                />
              </div>

              {pinError && <p className="text-sm text-destructive">{pinError}</p>}

              <Button onClick={handleVerifyPin}>
                <Lock className="mr-2 h-4 w-4" />
                Buka Kunci
              </Button>
            </div>
          ) : (
            // Unlocked - show settings
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                <Check className="h-5 w-5" />
                <span className="text-sm">Terverifikasi - Anda dapat mengubah pengaturan</span>
              </div>

              <div className="space-y-4">
                {/* Client ID */}
                <div className="space-y-2">
                  <Label htmlFor="doku_client_id">DOKU Client ID</Label>
                  <div className="relative">
                    <Input
                      id="doku_client_id"
                      type={showClientId ? "text" : "password"}
                      placeholder="Masukkan Client ID"
                      value={pgFormData.doku_client_id}
                      onChange={(e) => setPgFormData({ ...pgFormData, doku_client_id: e.target.value })}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowClientId(!showClientId)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showClientId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Secret Key */}
                <div className="space-y-2">
                  <Label htmlFor="doku_secret_key">DOKU Secret Key</Label>
                  <div className="relative">
                    <Input
                      id="doku_secret_key"
                      type={showSecretKey ? "text" : "password"}
                      placeholder="Masukkan Secret Key"
                      value={pgFormData.doku_secret_key}
                      onChange={(e) => setPgFormData({ ...pgFormData, doku_secret_key: e.target.value })}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecretKey(!showSecretKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Environment */}
                <div className="space-y-2">
                  <Label htmlFor="doku_environment">Environment</Label>
                  <Select
                    value={pgFormData.doku_environment}
                    onValueChange={(value: "sandbox" | "production") => 
                      setPgFormData({ ...pgFormData, doku_environment: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                      <SelectItem value="production">Production</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {pinError && <p className="text-sm text-destructive">{pinError}</p>}
              {pgSaved && (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                  <Check className="h-5 w-5" />
                  <span className="text-sm font-medium">Pengaturan berhasil disimpan!</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button onClick={handleSavePgSettings} disabled={pgSaving}>
                  {pgSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Simpan Kredensial
                </Button>
                <Button variant="outline" onClick={() => setIsUnlocked(false)}>
                  <Lock className="mr-2 h-4 w-4" />
                  Kunci
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Preview Card */}
        {formData.name && (
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="mb-4 text-sm font-medium text-muted-foreground">
              Preview di Invoice
            </h3>
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-lg font-bold text-foreground">{formData.name}</p>
              {formData.address && (
                <p className="mt-1 text-sm text-muted-foreground">{formData.address}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {formData.phone && <span>📱 {formData.phone}</span>}
                {formData.email && <span>✉️ {formData.email}</span>}
                {formData.instagram && <span>📷 {formData.instagram}</span>}
                {formData.facebook && <span>👤 {formData.facebook}</span>}
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
