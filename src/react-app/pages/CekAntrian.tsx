import { useState } from "react";
import { Search, Package, Clock, CheckCircle2, Loader2, AlertCircle, Phone, MapPin } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { Progress } from "@/react-app/components/ui/progress";
import { supabase } from "@/react-app/lib/supabase";

interface OrderItem {
  product_name: string;
  quantity: number;
  method: string;
  deadline_date: string;
  status: {
    label: string;
    progress: number;
    color: string;
  };
}

interface QueueResult {
  order_number: string;
  client_name: string;
  total_amount: number;
  paid_amount: number;
  is_paid: boolean;
  created_at: string;
  items: OrderItem[];
  store: {
    name: string;
    phone: string;
    address: string;
  } | null;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export default function CekAntrianPage() {
  const [orderNumber, setOrderNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueueResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .select("*")
        .eq("order_number", orderNumber.trim())
        .maybeSingle();
      
      if (orderErr || !order) {
        setError("Pesanan tidak ditemukan. Pastikan nomor pesanan benar.");
        return;
      }

      const { data: items } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", order.id);
      
      setResult({ ...order, items: items ?? [] });
    } catch {
      setError("Gagal menghubungi server. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (color: string) => {
    switch (color) {
      case "green":
        return "bg-green-500";
      case "blue":
        return "bg-blue-500";
      case "orange":
        return "bg-orange-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusBgColor = (color: string) => {
    switch (color) {
      case "green":
        return "bg-green-50 border-green-200";
      case "blue":
        return "bg-blue-50 border-blue-200";
      case "orange":
        return "bg-orange-50 border-orange-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  const getStatusTextColor = (color: string) => {
    switch (color) {
      case "green":
        return "text-green-700";
      case "blue":
        return "text-blue-700";
      case "orange":
        return "text-orange-700";
      default:
        return "text-gray-700";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-teal-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {result?.store?.name || "Cek Antrian"}
              </h1>
              <p className="text-sm text-gray-500">Live Status Pesanan</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Search Form */}
        <Card className="mb-8 shadow-lg border-teal-100">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="w-5 h-5 text-teal-600" />
              Cek Status Pesanan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-3">
              <Input
                type="text"
                placeholder="Masukkan nomor pesanan (contoh: ORD-2024-001)"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                className="flex-1 text-base"
              />
              <Button type="submit" disabled={loading || !orderNumber.trim()}>
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Cari
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Error State */}
        {error && (
          <Card className="mb-8 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-red-700">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p>{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-6">
            {/* Order Summary */}
            <Card className="shadow-lg border-teal-100">
              <CardHeader className="bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-t-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-teal-100 text-sm">Nomor Pesanan</p>
                    <p className="text-2xl font-bold font-mono">{result.order_number}</p>
                  </div>
                  <div className={`px-4 py-2 rounded-full text-sm font-semibold ${
                    result.is_paid 
                      ? "bg-green-100 text-green-700" 
                      : "bg-orange-100 text-orange-700"
                  }`}>
                    {result.is_paid ? "✓ Lunas" : "Belum Lunas"}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Nama Pelanggan</p>
                    <p className="font-semibold text-gray-900">{result.client_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Tanggal Pesanan</p>
                    <p className="font-semibold text-gray-900">{formatDate(result.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Total Pesanan</p>
                    <p className="font-semibold text-gray-900">{formatCurrency(result.total_amount)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Sisa Bayar</p>
                    <p className={`font-semibold ${result.is_paid ? "text-green-600" : "text-orange-600"}`}>
                      {formatCurrency(result.total_amount - result.paid_amount)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Items Status */}
            <Card className="shadow-lg border-teal-100">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5 text-teal-600" />
                  Status Item Pesanan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.items.map((item, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-xl border-2 ${getStatusBgColor(item.status.color)}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900">{item.product_name}</h4>
                        <p className="text-sm text-gray-500">
                          Qty: {item.quantity} • Deadline: {formatDate(item.deadline_date)}
                        </p>
                      </div>
                      {item.status.progress === 100 && (
                        <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className={`font-medium ${getStatusTextColor(item.status.color)}`}>
                          {item.status.label}
                        </span>
                        <span className="text-gray-500">{item.status.progress}%</span>
                      </div>
                      <Progress 
                        value={item.status.progress} 
                        className="h-2"
                        indicatorClassName={getStatusColor(item.status.color)}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Store Contact */}
            {result.store && (
              <Card className="shadow-lg border-teal-100">
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-500 mb-3">Ada pertanyaan? Hubungi kami:</p>
                  <div className="space-y-2">
                    {result.store.phone && (
                      <a 
                        href={`tel:${result.store.phone}`}
                        className="flex items-center gap-2 text-teal-600 hover:text-teal-700"
                      >
                        <Phone className="w-4 h-4" />
                        {result.store.phone}
                      </a>
                    )}
                    {result.store.address && (
                      <div className="flex items-start gap-2 text-gray-600">
                        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        {result.store.address}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Empty State */}
        {!result && !error && !loading && (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-10 h-10 text-teal-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Cek Status Pesanan Anda
            </h3>
            <p className="text-gray-500 max-w-sm mx-auto">
              Masukkan nomor pesanan untuk melihat status terkini dari pesanan Anda secara real-time.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-teal-100 bg-white/50 mt-16">
        <div className="max-w-3xl mx-auto px-4 py-6 text-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} {result?.store?.name || "Cetak Foto Apps"}</p>
        </div>
      </footer>
    </div>
  );
}
