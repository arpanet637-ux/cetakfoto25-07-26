import { Hono } from "hono";

const app = new Hono<{ Bindings: Env }>();

// Public endpoint - no auth required
// Get order status by order number
app.get("/check/:orderNumber", async (c) => {
  const db = c.env.DB;
  const orderNumber = c.req.param("orderNumber");

  const order = await db
    .prepare(
      `SELECT id, order_number, client_name, total_amount, paid_amount, created_at, updated_at 
       FROM orders WHERE order_number = ?`
    )
    .bind(orderNumber)
    .first();

  if (!order) {
    return c.json({ error: "Pesanan tidak ditemukan" }, 404);
  }

  // Get order items with status
  const items = await db
    .prepare(
      `SELECT id, product_name, quantity, method, deadline_date, 
              status_work, status_send, status_payment, status_pickup
       FROM order_items WHERE order_id = ? ORDER BY id ASC`
    )
    .bind(order.id)
    .all();

  // Get store settings for display
  const storeSettings = await db
    .prepare("SELECT name, phone, address FROM store_settings LIMIT 1")
    .first();

  return c.json({
    order_number: order.order_number,
    client_name: order.client_name,
    total_amount: order.total_amount,
    paid_amount: order.paid_amount,
    is_paid: (order.paid_amount as number) >= (order.total_amount as number),
    created_at: order.created_at,
    items: items.results.map((item) => ({
      product_name: item.product_name,
      quantity: item.quantity,
      method: item.method,
      deadline_date: item.deadline_date,
      status: getItemStatus(item),
    })),
    store: storeSettings ? {
      name: storeSettings.name,
      phone: storeSettings.phone,
      address: storeSettings.address,
    } : null,
  });
});

function getItemStatus(item: Record<string, unknown>): {
  label: string;
  progress: number;
  color: string;
} {
  if (item.method === "cetak_sendiri") {
    switch (item.status_work) {
      case "selesai":
        return { label: "Selesai - Siap Diambil", progress: 100, color: "green" };
      case "sedang_dikerjakan":
        return { label: "Sedang Dikerjakan", progress: 50, color: "blue" };
      default:
        return { label: "Menunggu Antrian", progress: 10, color: "orange" };
    }
  } else {
    // tim_produksi
    if (item.status_pickup === "sudah_diambil") {
      return { label: "Selesai - Sudah Diambil", progress: 100, color: "green" };
    }
    if (item.status_send === "sudah_dikirim" && item.status_payment === "sudah_bayar") {
      return { label: "Siap Diambil", progress: 90, color: "green" };
    }
    if (item.status_send === "sudah_dikirim") {
      return { label: "Barang Sudah Tiba", progress: 70, color: "blue" };
    }
    return { label: "Dalam Proses Vendor", progress: 30, color: "orange" };
  }
}

export default app;
