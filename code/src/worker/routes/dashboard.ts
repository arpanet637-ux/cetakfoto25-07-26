import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";

const app = new Hono<{ Bindings: Env }>();

// Apply auth middleware to all routes
app.use("/*", authMiddleware);

// Get dashboard statistics
app.get("/stats", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const today = new Date().toISOString().split("T")[0];

  // Total active orders (not fully completed)
  const activeOrders = await db
    .prepare(
      `SELECT COUNT(DISTINCT o.id) as count
       FROM orders o
       JOIN order_items oi ON o.id = oi.order_id
       WHERE o.user_id = ?
         AND ((oi.method = 'cetak_sendiri' AND oi.status_work != 'selesai')
              OR (oi.method = 'tim_produksi' AND oi.status_pickup != 'sudah_diambil'))`
    )
    .bind(user.id)
    .first();

  // Pending vendor (tim_produksi not picked up)
  const pendingVendor = await db
    .prepare(
      `SELECT COUNT(*) as count FROM order_items
       WHERE user_id = ? AND method = 'tim_produksi' AND status_pickup != 'sudah_diambil'`
    )
    .bind(user.id)
    .first();

  // Deadline today
  const deadlineToday = await db
    .prepare(
      `SELECT COUNT(*) as count FROM order_items
       WHERE user_id = ? AND deadline_date <= ?
         AND ((method = 'cetak_sendiri' AND status_work != 'selesai')
              OR (method = 'tim_produksi' AND status_pickup != 'sudah_diambil'))`
    )
    .bind(user.id, today)
    .first();

  // Unpaid orders (orders where paid_amount < total_amount)
  const unpaidOrders = await db
    .prepare(
      `SELECT COUNT(*) as count FROM orders
       WHERE user_id = ? AND paid_amount < total_amount`
    )
    .bind(user.id)
    .first();

  return c.json({
    totalActiveOrders: Number((activeOrders as Record<string, unknown>)?.count) || 0,
    pendingVendor: Number((pendingVendor as Record<string, unknown>)?.count) || 0,
    deadlineToday: Number((deadlineToday as Record<string, unknown>)?.count) || 0,
    unpaidOrders: Number((unpaidOrders as Record<string, unknown>)?.count) || 0,
  });
});

// Get deadline notifications (red)
app.get("/notifications/deadline", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const today = new Date().toISOString().split("T")[0];

  const notifications = await db
    .prepare(
      `SELECT oi.id, oi.order_id, o.order_number, o.client_name, oi.product_name, 
              oi.method, oi.deadline_date,
              CASE 
                WHEN oi.method = 'cetak_sendiri' THEN oi.status_work
                ELSE oi.status_pickup
              END as status
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE o.user_id = ? AND oi.deadline_date <= ?
         AND ((oi.method = 'cetak_sendiri' AND oi.status_work != 'selesai')
              OR (oi.method = 'tim_produksi' AND oi.status_pickup != 'sudah_diambil'))
       ORDER BY oi.deadline_date ASC`
    )
    .bind(user.id, today)
    .all();

  return c.json(notifications.results);
});

// Get vendor progress notifications (white/gray)
app.get("/notifications/vendor", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;

  const notifications = await db
    .prepare(
      `SELECT oi.id, oi.order_id, o.order_number, o.client_name, oi.product_name,
              oi.status_send, oi.status_payment, oi.status_pickup, oi.deadline_date
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE o.user_id = ? AND oi.method = 'tim_produksi' AND oi.status_pickup != 'sudah_diambil'
       ORDER BY oi.deadline_date ASC`
    )
    .bind(user.id)
    .all();

  return c.json(notifications.results);
});

// Get payment status notifications (orange) - shows which clients have paid or not
app.get("/notifications/payment-status", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;

  const notifications = await db
    .prepare(
      `SELECT o.id, o.order_number, o.client_name, o.total_amount, o.paid_amount,
              o.created_at,
              (SELECT MIN(oi.deadline_date) FROM order_items oi WHERE oi.order_id = o.id) as nearest_deadline
       FROM orders o
       WHERE o.user_id = ?
       ORDER BY o.created_at DESC`
    )
    .bind(user.id)
    .all();

  return c.json(notifications.results);
});

// Get low stock notifications (blue)
app.get("/notifications/stock", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;

  const notifications = await db
    .prepare(
      `SELECT id, name, stock, min_stock
       FROM products
       WHERE user_id = ? AND stock <= min_stock
       ORDER BY (min_stock - stock) DESC`
    )
    .bind(user.id)
    .all();

  return c.json(notifications.results);
});

// Get financial summary
app.get("/financial", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const month = c.req.query("month") || new Date().toISOString().slice(0, 7);

  // Total revenue (paid amount)
  const revenue = await db
    .prepare(
      `SELECT COALESCE(SUM(paid_amount), 0) as total FROM orders
       WHERE user_id = ? AND strftime('%Y-%m', created_at) = ?`
    )
    .bind(user.id, month)
    .first();

  // Total expenses by type
  const expenses = await db
    .prepare(
      `SELECT expense_type, COALESCE(SUM(amount), 0) as total
       FROM expenses
       WHERE user_id = ? AND strftime('%Y-%m', expense_date) = ?
       GROUP BY expense_type`
    )
    .bind(user.id, month)
    .all();

  let operasional = 0;
  let vendor = 0;

  expenses.results.forEach((row: Record<string, unknown>) => {
    if (row.expense_type === "operasional") {
      operasional = Number(row.total) || 0;
    } else if (row.expense_type === "vendor") {
      vendor = Number(row.total) || 0;
    }
  });

  const totalRevenue = Number((revenue as Record<string, unknown>)?.total) || 0;
  const totalExpenses = operasional + vendor;
  const netProfit = totalRevenue - totalExpenses;

  return c.json({
    revenue: totalRevenue,
    expenses: {
      operasional,
      vendor,
      total: totalExpenses,
    },
    netProfit,
  });
});

export default app;
