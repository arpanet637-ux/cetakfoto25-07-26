import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import { X, Printer, Send, Loader2, Download } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import type { OrderWithItems, Branch } from "@/shared/types";
import type { StoreSettings } from "@/react-app/hooks/useStoreSettings";

interface InvoicePreviewProps {
  order: OrderWithItems;
  storeSettings: StoreSettings | null;
  branches?: Branch[];
  onClose: () => void;
  onOrderUpdated?: () => void;
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

export default function InvoicePreview({
  order,
  storeSettings,
  branches = [],
  onClose,
  onOrderUpdated: _onOrderUpdated,
}: InvoicePreviewProps) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const branchName = order.branch_id 
    ? branches.find(b => b.id === order.branch_id)?.name 
    : null;
  
  const remainingAmount = order.total_amount - order.paid_amount;
  
  // Calculate admin fee using QRIS rate (most common)
  const adminFeePercent = storeSettings?.admin_fee_qris || 0;
  const adminFee = remainingAmount > 0 ? Math.ceil(remainingAmount * (adminFeePercent / 100)) : 0;
  const totalWithFee = remainingAmount + adminFee;

  const handleDownloadJPG = async () => {
    const invoiceElement = invoiceRef.current;
    if (!invoiceElement) return;

    setDownloading(true);
    try {
      const canvas = await html2canvas(invoiceElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      // Convert to JPG and download
      const link = document.createElement("a");
      link.download = `invoice-${order.order_number}.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.9);
      link.click();
    } catch (error) {
      console.error("Error downloading invoice:", error);
      alert("Gagal download invoice. Silakan coba lagi.");
    }
    setDownloading(false);
  };

  const handleSendWhatsApp = async () => {
    if (!order.client_phone) {
      alert("Nomor telepon pelanggan tidak tersedia");
      return;
    }

    setSendingWhatsApp(true);
    
    try {
      // Format phone number for WhatsApp
      let phone = order.client_phone.replace(/\D/g, "");
      if (phone.startsWith("0")) {
        phone = "62" + phone.slice(1);
      } else if (!phone.startsWith("62")) {
        phone = "62" + phone;
      }

      const storeName = storeSettings?.name || "BisnisKu";
      
      // Build WhatsApp message as text
      let message = `📄 *INVOICE - ${storeName}*\n\n`;
      message += `No: ${order.order_number}\n`;
      message += `Tanggal: ${formatDate(order.created_at)}\n`;
      message += `Kepada: ${order.client_name}\n\n`;
      
      // List items
      message += `*Detail Pesanan:*\n`;
      (order.items || []).forEach((item) => {
        message += `• ${item.product_name} x${item.quantity} = ${formatCurrency(item.subtotal)}\n`;
      });
      
      message += `\n*TOTAL: ${formatCurrency(order.total_amount)}*\n`;
      message += `Dibayar: ${formatCurrency(order.paid_amount)}\n`;
      
      if (remainingAmount > 0) {
        message += `Sisa Bayar: ${formatCurrency(remainingAmount)}\n`;
        
        // Add admin fee to total if configured
        if (adminFee > 0) {
          message += `Biaya Admin: +${formatCurrency(adminFee)}\n`;
          message += `*Total Bayar: ${formatCurrency(totalWithFee)}*\n`;
        }
        
        // Payment gateway link creation would require an edge function with DOKU keys
        // For now, skip link generation
      } else {
        message += `\n✅ *LUNAS*\n`;
      }
      
      message += `\nTerima kasih! 🙏`;

      // Open WhatsApp
      const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      window.open(waUrl, "_blank");
      
    } catch (error) {
      console.error("Error sending WhatsApp:", error);
      alert("Gagal mengirim invoice. Silakan coba lagi.");
    }
    
    setSendingWhatsApp(false);
  };

  const handlePrint = () => {
    const printContent = invoiceRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${order.order_number}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1a1a1a; }
            .invoice { max-width: 800px; margin: 0 auto; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #0d9488; }
            .store-name { font-size: 28px; font-weight: 700; color: #0d9488; margin-bottom: 8px; }
            .store-info { font-size: 13px; color: #666; line-height: 1.6; }
            .invoice-title { text-align: right; }
            .invoice-title h2 { font-size: 32px; font-weight: 700; color: #1a1a1a; }
            .invoice-number { font-size: 14px; color: #666; margin-top: 8px; }
            .client-section { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .client-box { background: #f8fafb; padding: 20px; border-radius: 8px; flex: 1; }
            .client-box:first-child { margin-right: 20px; }
            .client-label { font-size: 11px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
            .client-value { font-size: 15px; color: #1a1a1a; line-height: 1.5; }
            .client-name { font-weight: 600; font-size: 16px; margin-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { background: #0d9488; color: white; padding: 14px 12px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
            th:last-child, td:last-child { text-align: right; }
            td { padding: 14px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
            tr:hover td { background: #f8fafb; }
            .product-name { font-weight: 500; }
            .discount { color: #16a34a; font-size: 12px; }
            .totals { display: flex; justify-content: flex-end; }
            .totals-box { width: 300px; }
            .total-row { display: flex; justify-content: space-between; padding: 10px 0; font-size: 14px; }
            .total-row.grand { border-top: 2px solid #0d9488; margin-top: 10px; padding-top: 15px; font-size: 18px; font-weight: 700; color: #0d9488; }
            .total-row.discount { color: #ea580c; }
            .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #888; }
            .notes { background: #fffbeb; padding: 15px; border-radius: 8px; margin-bottom: 30px; font-size: 13px; color: #92400e; }
            .notes-label { font-weight: 600; margin-bottom: 5px; }
            @media print {
              body { padding: 20px; }
              .invoice { max-width: 100%; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const storeName = storeSettings?.name || "BisnisKu";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative flex max-h-[95vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-2xl">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Preview Invoice
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Button 
              onClick={handleSendWhatsApp} 
              variant="outline" 
              className="gap-2"
              disabled={sendingWhatsApp || !order.client_phone}
              title={!order.client_phone ? "Nomor telepon pelanggan tidak tersedia" : ""}
            >
              {sendingWhatsApp ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              WhatsApp
            </Button>
            <Button 
              onClick={handleDownloadJPG} 
              variant="outline" 
              className="gap-2"
              disabled={downloading}
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download JPG
            </Button>
            <Button onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              Cetak
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Invoice Content */}
        <div className="flex-1 overflow-auto bg-gray-100 p-6">
          <div
            ref={invoiceRef}
            className="invoice mx-auto max-w-3xl rounded-lg bg-white p-10 shadow-sm"
          >
            {/* Header */}
            <div className="header mb-10 flex items-start justify-between border-b-2 border-teal-600 pb-6">
              <div>
                <h1 className="store-name text-3xl font-bold text-teal-600">
                  {storeName}
                </h1>
                <div className="store-info mt-2 text-sm text-gray-500 leading-relaxed">
                  {storeSettings?.address && <div>{storeSettings.address}</div>}
                  {storeSettings?.phone && <div>Tel: {storeSettings.phone}</div>}
                  {storeSettings?.email && <div>{storeSettings.email}</div>}
                  {storeSettings?.instagram && (
                    <div>IG: @{storeSettings.instagram}</div>
                  )}
                </div>
              </div>
              <div className="invoice-title text-right">
                <h2 className="text-4xl font-bold text-gray-900">INVOICE</h2>
                <div className="invoice-number mt-2 text-sm text-gray-500">
                  <div className="font-mono font-semibold text-teal-600">
                    {order.order_number}
                  </div>
                  <div>{formatDate(order.created_at)}</div>
                  {branchName && (
                    <div className="mt-1 font-medium text-gray-700">
                      Cabang: {branchName}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Client Info */}
            <div className="client-section mb-8 grid grid-cols-2 gap-6">
              <div className="client-box rounded-lg bg-gray-50 p-5">
                <div className="client-label mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Ditagihkan kepada
                </div>
                <div className="client-name text-lg font-semibold text-gray-900">
                  {order.client_name}
                </div>
                {order.client_phone && (
                  <div className="client-value text-sm text-gray-600">
                    {order.client_phone}
                  </div>
                )}
                {order.client_address && (
                  <div className="client-value mt-1 text-sm text-gray-600">
                    {order.client_address}
                  </div>
                )}
              </div>
              <div className="client-box rounded-lg bg-gray-50 p-5">
                <div className="client-label mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Detail Pembayaran
                </div>
                <div className="text-sm text-gray-600">
                  <div className="flex justify-between py-1">
                    <span>Status:</span>
                    <span
                      className={`font-medium ${
                        order.paid_amount >= order.total_amount
                          ? "text-green-600"
                          : "text-orange-600"
                      }`}
                    >
                      {order.paid_amount >= order.total_amount
                        ? "Lunas"
                        : "Belum Lunas"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Terbayar:</span>
                    <span>{formatCurrency(order.paid_amount)}</span>
                  </div>
                  {order.paid_amount < order.total_amount && (
                    <div className="flex justify-between py-1 font-medium text-red-600">
                      <span>Sisa:</span>
                      <span>
                        {formatCurrency(order.total_amount - order.paid_amount)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            {order.notes && (
              <div className="notes mb-6 rounded-lg bg-amber-50 p-4">
                <div className="notes-label text-sm font-semibold text-amber-800">
                  Catatan:
                </div>
                <div className="text-sm text-amber-700">{order.notes}</div>
              </div>
            )}

            {/* Items Table */}
            <table className="mb-8 w-full">
              <thead>
                <tr className="bg-teal-600 text-white">
                  <th className="rounded-tl-lg px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                    Produk
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide">
                    Qty
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">
                    Harga
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">
                    Diskon
                  </th>
                  <th className="rounded-tr-lg px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody>
                {(order.items || []).map((item, index) => (
                  <tr key={item.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-4 py-3">
                      <div className="product-name font-medium text-gray-900">
                        {item.product_name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {formatCurrency(item.unit_price)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.discount > 0 ? (
                        <span className="discount text-green-600">
                          -{formatCurrency(item.discount)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatCurrency(item.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="totals flex justify-end">
              <div className="totals-box w-72">
                <div className="total-row flex justify-between py-2 text-sm text-gray-600">
                  <span>Subtotal:</span>
                  <span>{formatCurrency((order.items || []).reduce((sum, item) => sum + item.subtotal, 0))}</span>
                </div>
                {order.discount && order.discount > 0 && (
                  <div className="total-row discount flex justify-between py-2 text-sm text-orange-600">
                    <span>Diskon:</span>
                    <span>-{formatCurrency(order.discount)}</span>
                  </div>
                )}
                <div className="total-row grand mt-2 flex justify-between border-t-2 border-teal-600 pt-3 text-xl font-bold text-teal-600">
                  <span>TOTAL:</span>
                  <span>{formatCurrency(order.total_amount)}</span>
                </div>
                <div className="total-row flex justify-between py-2 text-base font-semibold text-gray-700">
                  <span>Dibayar:</span>
                  <span>{formatCurrency(order.paid_amount)}</span>
                </div>
                <div className="total-row flex justify-between py-2 text-base">
                  <span>Sisa Bayar:</span>
                  <span className={remainingAmount > 0 ? "text-red-600 font-bold" : "text-green-600 font-bold"}>
                    {formatCurrency(remainingAmount)}
                  </span>
                </div>
                {remainingAmount > 0 && adminFee > 0 && (
                  <>
                    <div className="total-row flex justify-between py-2 text-sm text-blue-600">
                      <span>Biaya Admin ({adminFeePercent}%):</span>
                      <span>+{formatCurrency(adminFee)}</span>
                    </div>
                    <div className="total-row flex justify-between py-2 text-lg font-bold text-blue-700 border-t border-blue-200 mt-2 pt-2">
                      <span>Total Bayar:</span>
                      <span>{formatCurrency(totalWithFee)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="footer mt-12 border-t border-gray-200 pt-6 text-center text-sm text-gray-400">
              <p>Terima kasih atas kepercayaan Anda!</p>
              <p className="mt-1">
                Invoice ini sah dan dibuat secara digital oleh {storeName}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
