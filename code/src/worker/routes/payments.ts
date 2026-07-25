import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";

type Env = {
  DB: D1Database;
};

type Variables = {
  user: { id: string };
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply auth middleware
app.use("/*", authMiddleware);

// Get user helper
const getUser = (c: any) => c.get("user") as { id: string };

// Get recent payment notifications (prioritize DOKU/gateway payments)
app.get("/notifications", async (c) => {
  const user = getUser(c);
  
  // Get ALL recent payment records - show DOKU payments and full payments
  // This ensures payment gateway transactions always appear as notifications
  const notifications = await c.env.DB.prepare(
    `SELECT 
       pr.id,
       pr.order_id,
       pr.amount,
       pr.payment_method,
       pr.payment_type,
       pr.created_at,
       o.client_name,
       o.order_number,
       o.total_amount,
       o.paid_amount
     FROM payment_records pr
     JOIN orders o ON pr.order_id = o.id
     WHERE pr.user_id = ? 
       AND (
         pr.payment_method LIKE '%DOKU%' 
         OR pr.payment_method LIKE '%Transfer%'
         OR o.paid_amount >= o.total_amount
       )
     ORDER BY pr.created_at DESC
     LIMIT 20`
  ).bind(user.id).all();
  
  return c.json(notifications.results);
});

// Get payment records for an order
app.get("/order/:orderId", async (c) => {
  const user = getUser(c);
  const orderId = parseInt(c.req.param("orderId"));
  
  const payments = await c.env.DB.prepare(
    `SELECT * FROM payment_records 
     WHERE order_id = ? AND user_id = ?
     ORDER BY created_at ASC`
  ).bind(orderId, user.id).all();
  
  return c.json(payments.results);
});

// Create a new payment record
app.post("/", async (c) => {
  const user = getUser(c);
  const body = await c.req.json();
  const { order_id, amount, payment_method, payment_type } = body;
  
  const now = new Date().toISOString();
  
  // Insert payment record
  const result = await c.env.DB.prepare(
    `INSERT INTO payment_records (order_id, amount, payment_method, payment_type, user_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(order_id, amount, payment_method, payment_type, user.id, now, now).run();
  
  // Update order paid_amount
  await c.env.DB.prepare(
    `UPDATE orders SET paid_amount = paid_amount + ?, updated_at = ? WHERE id = ? AND user_id = ?`
  ).bind(amount, now, order_id, user.id).run();
  
  return c.json({ id: result.meta.last_row_id, success: true });
});

// Delete a payment record
app.delete("/:id", async (c) => {
  const user = getUser(c);
  const id = parseInt(c.req.param("id"));
  
  // Get the payment record first
  const payment = await c.env.DB.prepare(
    `SELECT * FROM payment_records WHERE id = ? AND user_id = ?`
  ).bind(id, user.id).first();
  
  if (!payment) {
    return c.json({ error: "Payment not found" }, 404);
  }
  
  const now = new Date().toISOString();
  
  // Delete the payment record
  await c.env.DB.prepare(
    `DELETE FROM payment_records WHERE id = ? AND user_id = ?`
  ).bind(id, user.id).run();
  
  // Update order paid_amount
  await c.env.DB.prepare(
    `UPDATE orders SET paid_amount = paid_amount - ?, updated_at = ? WHERE id = ? AND user_id = ?`
  ).bind(payment.amount, now, payment.order_id, user.id).run();
  
  return c.json({ success: true });
});

export default app;
