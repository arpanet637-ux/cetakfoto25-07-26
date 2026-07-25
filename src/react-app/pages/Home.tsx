import { useEffect } from "react";
import MainLayout from "@/react-app/components/layout/MainLayout";
import NotificationCard from "@/react-app/components/dashboard/NotificationCard";
import StatCard from "@/react-app/components/dashboard/StatCard";
import { useDashboard } from "@/react-app/hooks/useDashboard";
import {
  ShoppingCart,
  Package,
  CreditCard,
  AlertTriangle,
  Loader2,
} from "lucide-react";

// Helper to format currency
const formatCurrency = (amount: number) => {
  if (amount >= 1000000) {
    return `Rp ${(amount / 1000000).toFixed(1)}jt`;
  }
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
};

// Helper for deadline display
const getDeadlineText = (deadline: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadlineDate = new Date(deadline);
  deadlineDate.setHours(0, 0, 0, 0);
  const diffDays = Math.round((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `Lewat ${Math.abs(diffDays)} hari`;
  if (diffDays === 0) return "Hari ini";
  if (diffDays === 1) return "Besok";
  return `${diffDays} hari lagi`;
};

// Helper for date formatting
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

// Interface for expanded vendor notifications
interface ExpandedVendorNotif {
  id: string;
  order_number: string;
  client_name: string;
  product_name: string;
  deadline_date: string;
  status_type: 'belum_dikirim' | 'belum_bayar' | 'belum_diambil';
  status_label: string;
}

// Helper for method label
const getMethodLabel = (method: string) => {
  return method === "cetak_sendiri" ? "Cetak Sendiri" : "Tim Produksi";
};

export default function HomePage() {
  const {
    stats,
    deadlineNotifications,
    vendorNotifications,
    stockNotifications,
    paymentStatusNotifications,
    recentOrders,
    loading,
  } = useDashboard();

  // Expand vendor notifications into separate status notifications
  const expandedVendorNotifs: ExpandedVendorNotif[] = [];
  vendorNotifications.forEach((notif) => {
    if (notif.status_send === 'belum_dikirim') {
      expandedVendorNotifs.push({
        id: `${notif.id}-send`,
        order_number: notif.order_number,
        client_name: notif.client_name,
        product_name: notif.product_name,
        deadline_date: notif.deadline_date,
        status_type: 'belum_dikirim',
        status_label: 'Belum Dikirim ke Vendor',
      });
    }
    if (notif.status_payment === 'belum_bayar') {
      expandedVendorNotifs.push({
        id: `${notif.id}-pay`,
        order_number: notif.order_number,
        client_name: notif.client_name,
        product_name: notif.product_name,
        deadline_date: notif.deadline_date,
        status_type: 'belum_bayar',
        status_label: 'Belum Bayar Vendor',
      });
    }
    if (notif.status_pickup === 'belum_diambil') {
      expandedVendorNotifs.push({
        id: `${notif.id}-pickup`,
        order_number: notif.order_number,
        client_name: notif.client_name,
        product_name: notif.product_name,
        deadline_date: notif.deadline_date,
        status_type: 'belum_diambil',
        status_label: 'Belum Diambil dari Vendor',
      });
    }
  });

  useEffect(() => {
    const link = document.createElement("link");
    link.href =
      "https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);

  return (
    <MainLayout
      title="Dashboard"
      subtitle="Pantau bisnis Anda secara real-time"
    >
      <style>{`
        h1, h2, h3, h4 {
          font-family: 'Poppins', sans-serif;
        }
      `}</style>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={<ShoppingCart className="h-6 w-6 text-primary" />}
              label="Total Pesanan Aktif"
              value={String(stats?.totalActiveOrders || 0)}
              iconBgClass="bg-primary/10"
            />
            <StatCard
              icon={<Package className="h-6 w-6 text-info" />}
              label="Menunggu Vendor"
              value={String(stats?.pendingVendor || 0)}
              iconBgClass="bg-info/10"
            />
            <StatCard
              icon={<AlertTriangle className="h-6 w-6 text-destructive" />}
              label="Deadline Hari Ini"
              value={String(stats?.deadlineToday || 0)}
              iconBgClass="bg-destructive/10"
            />
            <StatCard
              icon={<CreditCard className="h-6 w-6 text-amber-500" />}
              label="Pesanan Belum Lunas"
              value={String(stats?.unpaidOrders || 0)}
              iconBgClass="bg-amber-500/10"
            />
          </div>

          {/* Notifications Section */}
          <div className="mt-8 sm:mt-10 grid gap-6 sm:gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {/* Deadline Notifications (Red) */}
            <div>
              <div className="mb-3 sm:mb-4 flex items-center gap-2">
                <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-red-500" />
                <h2 className="text-sm sm:text-lg font-semibold text-foreground">
                  Deadline Mendesak
                </h2>
                <span className="ml-auto rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  {deadlineNotifications.length}
                </span>
              </div>
              <div className="max-h-[300px] sm:max-h-[400px] space-y-2 sm:space-y-3 overflow-y-auto pr-1 scrollbar-thin">
                {deadlineNotifications.length > 0 ? (
                  deadlineNotifications.map((notif) => (
                    <NotificationCard
                      key={notif.id}
                      type="deadline"
                      title={`${notif.order_number} - ${notif.client_name}`}
                      description={`${notif.product_name} • ${getDeadlineText(notif.deadline_date)}`}
                      meta={`Deadline: ${formatDate(notif.deadline_date)} • ${getMethodLabel(notif.method)}`}
                    />
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      Tidak ada deadline mendesak
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Status Notifications (Orange) */}
            <div>
              <div className="mb-3 sm:mb-4 flex items-center gap-2">
                <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-amber-500" />
                <h2 className="text-sm sm:text-lg font-semibold text-foreground">
                  Status Pembayaran
                </h2>
                <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  {paymentStatusNotifications.length}
                </span>
              </div>
              <div className="max-h-[300px] sm:max-h-[400px] space-y-2 sm:space-y-3 overflow-y-auto pr-1 scrollbar-thin">
                {paymentStatusNotifications.length > 0 ? (
                  paymentStatusNotifications.map((notif) => {
                    const isPaid = notif.paid_amount >= notif.total_amount;
                    return (
                      <NotificationCard
                        key={notif.id}
                        type="warning"
                        title={`${notif.order_number} - ${notif.client_name}`}
                        description={
                          isPaid
                            ? `Lunas • ${formatCurrency(notif.total_amount)}`
                            : `Belum Lunas • ${formatCurrency(notif.paid_amount)} / ${formatCurrency(notif.total_amount)}`
                        }
                        meta={
                          <div className="mt-1 flex items-center gap-2">
                            <span className={isPaid ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                              {isPaid ? '✓ Sudah Bayar' : '✗ Belum Bayar'}
                            </span>
                            {notif.nearest_deadline && (
                              <span className="text-muted-foreground">
                                • Deadline: {formatDate(notif.nearest_deadline)}
                              </span>
                            )}
                          </div>
                        }
                      />
                    );
                  })
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      Tidak ada pesanan
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Progress Notifications (White/Gray) */}
            <div>
              <div className="mb-3 sm:mb-4 flex items-center gap-2">
                <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-slate-400" />
                <h2 className="text-sm sm:text-lg font-semibold text-foreground">
                  Progress Vendor
                </h2>
                <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {expandedVendorNotifs.length}
                </span>
              </div>
              <div className="max-h-[300px] sm:max-h-[400px] space-y-2 sm:space-y-3 overflow-y-auto pr-1 scrollbar-thin">
                {expandedVendorNotifs.length > 0 ? (
                  expandedVendorNotifs.map((notif) => (
                    <NotificationCard
                      key={notif.id}
                      type="progress"
                      title={`${notif.order_number} - ${notif.client_name}`}
                      description={`${notif.product_name} • ${notif.status_label}`}
                      meta={`Deadline: ${formatDate(notif.deadline_date)} • ${getDeadlineText(notif.deadline_date)}`}
                    />
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      Tidak ada pesanan di vendor
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Stock Notifications (Blue) */}
            <div>
              <div className="mb-3 sm:mb-4 flex items-center gap-2">
                <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-blue-500" />
                <h2 className="text-sm sm:text-lg font-semibold text-foreground">
                  Peringatan Stok
                </h2>
                <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {stockNotifications.length}
                </span>
              </div>
              <div className="max-h-[300px] sm:max-h-[400px] space-y-2 sm:space-y-3 overflow-y-auto pr-1 scrollbar-thin">
                {stockNotifications.length > 0 ? (
                  stockNotifications.map((notif) => (
                    <NotificationCard
                      key={notif.id}
                      type="stock"
                      title={`Stok ${notif.name} Menipis`}
                      description={`Tersisa ${notif.stock}, minimum stok: ${notif.min_stock}`}
                      meta="Segera lakukan restok"
                    />
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      Semua stok aman
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Orders Table */}
          <div className="mt-8 sm:mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-semibold text-foreground">
                Pesanan Terbaru
              </h2>
              <a
                href="/pesanan"
                className="text-sm font-medium text-primary hover:underline"
              >
                Lihat Semua →
              </a>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      No. Pesanan
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Klien
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Item
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Deadline Terdekat
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentOrders.length > 0 ? (
                    recentOrders.map((order) => {
                      const nearestDeadline = order.items?.length > 0
                        ? order.items.reduce((prev, curr) => {
                            if (!prev.deadline_date) return curr;
                            if (!curr.deadline_date) return prev;
                            return new Date(curr.deadline_date) < new Date(prev.deadline_date) ? curr : prev;
                          })
                        : null;
                      
                      const isUrgent = nearestDeadline?.deadline_date
                        ? new Date(nearestDeadline.deadline_date) <= new Date()
                        : false;

                      return (
                        <tr key={order.id} className="transition-colors hover:bg-muted/20">
                          <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-primary">
                            {order.order_number}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground">
                            {order.client_name}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                            {order.items?.length || 0} produk
                          </td>
                          <td className={`whitespace-nowrap px-6 py-4 text-sm ${isUrgent ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                            {nearestDeadline?.deadline_date
                              ? getDeadlineText(nearestDeadline.deadline_date)
                              : "-"}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-semibold text-foreground">
                            {formatCurrency(order.total_amount)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-sm text-muted-foreground">
                        Belum ada pesanan
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </MainLayout>
  );
}
