import { useState } from "react";
import { ChevronDown, ChevronUp, Trash2, Calendar, Phone, Edit2, Wallet, Package, PackageCheck, Image as ImageIcon } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { supabase } from "@/react-app/lib/supabase";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/react-app/components/ui/select";
import type { OrderWithItems, OrderItem, Product, Branch } from "@/shared/types";
import EditOrderModal from "./EditOrderModal";
import PaymentModal from "./PaymentModal";
import EditOrderItemsModal from "./EditOrderItemsModal";
import PickupModal from "./PickupModal";

interface OrderCardProps {
  order: OrderWithItems;
  products: Product[];
  branches: Branch[];
  onUpdateOrder: (id: number, data: { 
    client_name?: string; 
    client_phone?: string; 
    notes?: string; 
    paid_amount?: number; 
    discount?: number; 
    branch_id?: number | null;
    pickup_status?: "belum_diambil" | "sudah_diambil";
    pickup_date?: string;
    pickup_photo_key?: string;
    payment_method?: "cash" | "transfer";
  }) => Promise<void>;
  onUpdateItem: (orderId: number, itemId: number, data: Partial<OrderItem>) => Promise<void>;
  onAddItem: (orderId: number, item: {
    product_id?: number;
    product_name: string;
    quantity: number;
    unit_price: number;
    discount: number;
    method: "cetak_sendiri" | "tim_produksi";
    deadline_date: string;
  }) => Promise<void>;
  onDeleteItem: (orderId: number, itemId: number) => Promise<void>;
  onDeleteOrder: (id: number) => Promise<void>;
  onPaymentChanged?: () => void;
}

/**
 * Parse any value to a safe number, handling null, undefined, strings, etc.
 * Returns 0 if parsing fails or value is NaN.
 */
const parsePrice = (val: any): number => {
  if (typeof val === "number" && !isNaN(val)) return val;
  if (typeof val === "string") {
    const cleaned = val.replace(/[^0-9]/g, "");
    return cleaned ? parseInt(cleaned, 10) : 0;
  }
  return 0;
};

const formatCurrency = (amount: number | null | undefined) => {
  const safeAmount = parsePrice(amount);
  if (isNaN(safeAmount) || safeAmount === 0) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(0);
  }
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(safeAmount);
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const isDeadlineSoon = (deadlineDate: string) => {
  const deadline = new Date(deadlineDate);
  const today = new Date();
  const diffDays = Math.ceil(
    (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  return diffDays <= 2 && diffDays >= 0;
};

const isOverdue = (deadlineDate: string) => {
  const deadline = new Date(deadlineDate);
  const today = new Date();
  return deadline < today;
};

export default function OrderCard({ order, products, branches, onUpdateOrder, onUpdateItem, onAddItem, onDeleteItem, onDeleteOrder, onPaymentChanged }: OrderCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [showPickupPhoto, setShowPickupPhoto] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const handleDelete = async () => {
    if (confirm("Hapus pesanan ini?")) {
      setDeleting(true);
      await onDeleteOrder(order.id);
    }
  };

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getOverallStatus = () => {
    const items = order.items || [];
    if (items.length === 0) return { label: "Kosong", color: "bg-gray-100 text-gray-600" };

    const allComplete = items.every((item) => {
      if (item.method === "cetak_sendiri") {
        return item.status_work === "selesai";
      } else {
        return (
          item.status_send === "sudah_dikirim" &&
          item.status_payment === "sudah_bayar" &&
          item.status_pickup === "sudah_diambil"
        );
      }
    });

    if (allComplete) return { label: "Selesai", color: "bg-green-100 text-green-700" };

    const anyInProgress = items.some((item) => {
      if (item.method === "cetak_sendiri") {
        return item.status_work === "sedang_dikerjakan";
      }
      return false;
    });

    if (anyInProgress) return { label: "Sedang Dikerjakan", color: "bg-blue-100 text-blue-700" };

    return { label: "Menunggu", color: "bg-yellow-100 text-yellow-700" };
  };

  const getPaymentStatus = () => {
    const total = order.total_amount || 0;
    const paid = order.paid_amount || 0;
    
    if (paid >= total && total > 0) {
      return { label: "Lunas", color: "bg-green-100 text-green-700" };
    } else if (paid > 0) {
      return { label: "DP", color: "bg-yellow-100 text-yellow-700" };
    }
    return { label: "Belum Bayar", color: "bg-red-100 text-red-700" };
  };

  const status = getOverallStatus();
  const paymentStatus = getPaymentStatus();
  const branchName = order.branch_id ? branches.find(b => b.id === order.branch_id)?.name : null;
  const isPickedUp = order.pickup_status === "sudah_diambil";

  const getPickupStatusDisplay = () => {
    if (isPickedUp) {
      return { label: "Sudah Diambil", color: "bg-emerald-100 text-emerald-700" };
    }
    return { label: "Belum Diambil", color: "bg-gray-100 text-gray-600" };
  };

  const pickupStatusDisplay = getPickupStatusDisplay();

  const handlePickupConfirm = async (photoKey: string) => {
    await onUpdateOrder(order.id, {
      pickup_status: "sudah_diambil",
      pickup_date: new Date().toISOString(),
      pickup_photo_key: photoKey,
    });
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Header */}
        <div
          className="flex cursor-pointer items-center justify-between p-4 hover:bg-muted/50 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm text-primary font-semibold">
                  {order.order_number}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                  {status.label}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${paymentStatus.color}`}>
                  {paymentStatus.label}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${pickupStatusDisplay.color}`}>
                  {pickupStatusDisplay.label}
                </span>
              </div>
              <h3 className="font-semibold text-foreground mt-1.5">
                {order.client_name}
                {branchName && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {branchName}
                  </span>
                )}
              </h3>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                {order.client_phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {order.client_phone}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(order.created_at)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-lg font-bold text-foreground">
                {formatCurrency(
                  (order as any).total_amount ?? (order as any).total ?? (order as any).jumlah_total ?? 0
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                {(order.items || []).length} item
              </div>
            </div>
            {expanded ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Expanded Items */}
        {expanded && (
          <div className="border-t border-border">
            {/* Notes */}
            {order.notes && (
              <div className="px-4 py-3 bg-muted/30 text-sm text-muted-foreground border-b border-border">
                <span className="font-medium">Catatan:</span> {order.notes}
              </div>
            )}

            {/* Payment Info */}
            <div className="px-4 py-3 bg-muted/20 flex flex-wrap items-center justify-between gap-3 border-b border-border">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                {(() => {
                  const orderAny = order as any;
                  const paidAmount = parsePrice(
                    orderAny.paid_amount ?? orderAny.jumlah_bayar ?? 0
                  );
                  const totalAmount = parsePrice(
                    orderAny.total_amount ?? orderAny.total ?? orderAny.jumlah_total ?? 0
                  );
                  const orderDiscount = parsePrice(
                    orderAny.discount ?? orderAny.diskon ?? 0
                  );
                  const remaining = totalAmount - paidAmount;
                  return (
                    <>
                      <span className="text-muted-foreground">
                        Dibayar: <span className="font-semibold text-green-600">{formatCurrency(paidAmount)}</span>
                      </span>
                      <span className="text-muted-foreground">
                        Sisa: <span className="font-semibold text-foreground">{formatCurrency(remaining)}</span>
                      </span>
                      {orderDiscount > 0 && (
                        <span className="text-muted-foreground">
                          Diskon: <span className="font-semibold text-orange-600">-{formatCurrency(orderDiscount)}</span>
                        </span>
                      )}
                    </>
                  );
                })()}
                {order.payment_method && (
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    order.payment_method === "cash" 
                      ? "bg-emerald-100 text-emerald-700" 
                      : "bg-blue-100 text-blue-700"
                  }`}>
                    {order.payment_method === "cash" ? "Cash" : "Transfer"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {!isPickedUp && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPickupModal(true);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <PackageCheck className="mr-1.5 h-3.5 w-3.5" />
                    Ambil
                  </Button>
                )}
                {isPickedUp && order.pickup_photo_key && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPickupPhoto(true);
                    }}
                  >
                    <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
                    Foto
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowEditModal(true);
                  }}
                >
                  <Edit2 className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowItemsModal(true);
                  }}
                >
                  <Package className="mr-1.5 h-3.5 w-3.5" />
                  Item
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPaymentModal(true);
                  }}
                >
                  <Wallet className="mr-1.5 h-3.5 w-3.5" />
                  Pembayaran
                </Button>
              </div>
            </div>

            <div className="divide-y divide-border">
              {(order.items || []).map((item) => (
                <OrderItemRow
                  key={item.id}
                  item={item}
                  onUpdate={(data) => onUpdateItem(order.id, item.id, data)}
                />
              ))}
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/30">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Hapus Pesanan
              </Button>
              <div className="text-right">
                <span className="text-sm text-muted-foreground">Total: </span>
                <span className="text-lg font-bold">{formatCurrency(order.total_amount)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <EditOrderModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        order={order}
        branches={branches}
        onSubmit={async (data) => {
          await onUpdateOrder(order.id, data);
        }}
      />

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        order={order}
        onPaymentAdded={onPaymentChanged}
      />

      <EditOrderItemsModal
        isOpen={showItemsModal}
        onClose={() => setShowItemsModal(false)}
        order={order}
        products={products}
        onAddItem={async (item) => {
          await onAddItem(order.id, item);
        }}
        onUpdateItem={async (itemId, data) => {
          await onUpdateItem(order.id, itemId, data);
        }}
        onDeleteItem={async (itemId) => {
          await onDeleteItem(order.id, itemId);
        }}
      />

      <PickupModal
        isOpen={showPickupModal}
        onClose={() => setShowPickupModal(false)}
        order={order}
        onConfirm={handlePickupConfirm}
        onSuccess={() => showToast("Pengambilan berhasil disimpan!")}
      />

      {/* Pickup Photo Viewer */}
      {showPickupPhoto && order.pickup_photo_key && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setShowPickupPhoto(false)}
        >
          <div className="relative max-w-2xl w-full">
            <img
              src={supabase.storage.from("uploads").getPublicUrl(order.pickup_photo_key!).data.publicUrl}
              alt="Bukti pengambilan"
              className="w-full rounded-lg"
            />
            <button
              onClick={() => setShowPickupPhoto(false)}
              className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
            >
              <span className="sr-only">Tutup</span>
              ✕
            </button>
            {order.pickup_date && (
              <div className="absolute bottom-2 left-2 bg-black/50 text-white text-sm px-3 py-1 rounded">
                Diambil: {new Date(order.pickup_date).toLocaleString("id-ID")}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className={`px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${
            toast.type === "success" 
              ? "bg-green-600 text-white" 
              : "bg-red-600 text-white"
          }`}>
            {toast.type === "success" && (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </>
  );
}

interface OrderItemRowProps {
  item: OrderItem;
  onUpdate: (data: Partial<OrderItem>) => Promise<void>;
}

function OrderItemRow({ item, onUpdate }: OrderItemRowProps) {
  const deadlineSoon = isDeadlineSoon(item.deadline_date);
  const overdue = isOverdue(item.deadline_date);

  return (
    <div className="p-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{item.product_name}</span>
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${
                item.method === "cetak_sendiri"
                  ? "bg-teal-100 text-teal-700"
                  : "bg-purple-100 text-purple-700"
              }`}
            >
              {item.method === "cetak_sendiri" ? "Cetak Sendiri" : "Tim Produksi"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-muted-foreground">
            {(() => {
              // Cast to any to allow checking for multiple field name variants
              const itemAny = item as any;
              
              // Try multiple field name variants for unit price
              const unitPrice = parsePrice(
                itemAny.unit_price ?? itemAny.price ?? itemAny.unitPrice ?? itemAny.harga ?? 0
              );
              
              // Try multiple field name variants for quantity
              const qty = parsePrice(
                itemAny.quantity ?? itemAny.qty ?? itemAny.jumlah ?? 1
              ) || 1;
              
              // Try multiple field name variants for discount
              const discount = parsePrice(itemAny.discount ?? itemAny.diskon ?? 0);
              
              // Try to use subtotal if it exists, otherwise calculate it
              const subtotal = 
                parsePrice(itemAny.subtotal ?? itemAny.total_price) ||
                (unitPrice * qty - discount);
              
              return (
                <>
                  <span>{qty}x @ {formatCurrency(unitPrice)}</span>
                  {discount > 0 && (
                    <span className="text-green-600">-{formatCurrency(discount)}</span>
                  )}
                  <span className="font-medium text-foreground">
                    = {formatCurrency(subtotal)}
                  </span>
                </>
              );
            })()}
          </div>
          <div
            className={`flex items-center gap-1 mt-1.5 text-sm ${
              overdue
                ? "text-red-600 font-medium"
                : deadlineSoon
                ? "text-orange-600 font-medium"
                : "text-muted-foreground"
            }`}
          >
            <Calendar className="h-3 w-3" />
            Deadline: {formatDate(item.deadline_date)}
            {overdue && " (Terlambat!)"}
            {deadlineSoon && !overdue && " (Segera!)"}
          </div>
        </div>

        {/* Status Dropdowns */}
        <div className="flex flex-wrap gap-2">
          {item.method === "cetak_sendiri" ? (
            <Select
              value={item.status_work || "belum_dikerjakan"}
              onValueChange={(val) =>
                onUpdate({
                  status_work: val as "belum_dikerjakan" | "sedang_dikerjakan" | "selesai",
                })
              }
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="belum_dikerjakan">Belum Dikerjakan</SelectItem>
                <SelectItem value="sedang_dikerjakan">Sedang Dikerjakan</SelectItem>
                <SelectItem value="selesai">Selesai</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <>
              <Select
                value={item.status_send || "belum_dikirim"}
                onValueChange={(val) =>
                  onUpdate({
                    status_send: val as "belum_dikirim" | "sudah_dikirim",
                  })
                }
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="belum_dikirim">Belum Dikirim</SelectItem>
                  <SelectItem value="sudah_dikirim">Sudah Dikirim</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={item.status_payment || "belum_bayar"}
                onValueChange={(val) =>
                  onUpdate({
                    status_payment: val as "belum_bayar" | "sudah_bayar",
                  })
                }
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="belum_bayar">Belum Bayar</SelectItem>
                  <SelectItem value="sudah_bayar">Sudah Bayar</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={item.status_pickup || "belum_diambil"}
                onValueChange={(val) =>
                  onUpdate({
                    status_pickup: val as "belum_diambil" | "sudah_diambil",
                  })
                }
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="belum_diambil">Belum Diambil</SelectItem>
                  <SelectItem value="sudah_diambil">Sudah Diambil</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
