import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import {
  CreateOrderSchema,
  UpdateOrderSchema,
  CreateOrderItemSchema,
  UpdateOrderItemSchema,
} from "@/shared/types";
import { z } from "zod";

const app = new Hono<{ Bindings: Env }>();

// Apply auth middleware to all routes
app.use("/*", authMiddleware);

// Generate order number
function generateOrderNumber(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `ORD-${year}${month}${day}-${random}`;
}

// Export all orders with items as JSON
app.get("/export", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  
  const orders = await db
    .prepare(`SELECT order_number, client_name, client_phone, client_address, notes, total_amount, paid_amount, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC`)
    .bind(user.id)
    .all();

  const ordersWithItems = await Promise.all(
    orders.results.map(async (order: Record<string, unknown>) => {
      const items = await db
        .prepare(`SELECT product_name, quantity, unit_price, discount, subtotal, method, deadline_date, status_work, status_send, status_payment, status_pickup FROM order_items WHERE order_id = (SELECT id FROM orders WHERE order_number = ? AND user_id = ?) ORDER BY id ASC`)
        .bind(order.order_number, user.id)
        .all();
      return { ...order, items: items.results };
    })
  );

  const exportData = {
    type: "bisnisKu_orders_backup",
    version: 1,
    exported_at: new Date().toISOString(),
    orders: ordersWithItems,
  };

  return c.json(exportData);
});

// Import orders from JSON
app.post("/import", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const body = await c.req.json();

  if (body.type !== "bisnisKu_orders_backup") {
    return c.json({ error: "Format file tidak valid. Gunakan file backup pesanan dari BisnisKu." }, 400);
  }

  const OrderItemImportSchema = z.object({
    product_name: z.string().min(1),
    quantity: z.number().min(1),
    unit_price: z.number().min(0),
    discount: z.number().min(0),
    subtotal: z.number().min(0),
    method: z.enum(["cetak_sendiri", "tim_produksi"]),
    deadline_date: z.string(),
    status_work: z.string().nullable().optional(),
    status_send: z.string().nullable().optional(),
    status_payment: z.string().nullable().optional(),
    status_pickup: z.string().nullable().optional(),
  });

  const OrderImportSchema = z.object({
    order_number: z.string().min(1),
    client_name: z.string().min(1),
    client_phone: z.string().nullable().optional(),
    client_address: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    total_amount: z.number().min(0),
    paid_amount: z.number().min(0),
    created_at: z.string().optional(),
    items: z.array(OrderItemImportSchema).optional(),
  });

  const orders = body.orders;
  if (!Array.isArray(orders)) {
    return c.json({ error: "Data pesanan tidak valid." }, 400);
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const order of orders) {
    const parsed = OrderImportSchema.safeParse(order);
    if (!parsed.success) {
      skipped++;
      errors.push(`Pesanan "${order.order_number || 'unknown'}": data tidak valid`);
      continue;
    }

    const data = parsed.data;

    // Check if order with same order_number exists for this user
    const existing = await db
      .prepare("SELECT id FROM orders WHERE order_number = ? AND user_id = ?")
      .bind(data.order_number, user.id)
      .first();

    let orderId: number;

    if (existing) {
      // Update existing order
      await db
        .prepare(
          `UPDATE orders SET client_name = ?, client_phone = ?, client_address = ?, notes = ?, total_amount = ?, paid_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        )
        .bind(data.client_name, data.client_phone || null, data.client_address || null, data.notes || null, data.total_amount, data.paid_amount, existing.id)
        .run();
      orderId = existing.id as number;

      // Delete existing items to replace with imported ones
      await db.prepare("DELETE FROM order_items WHERE order_id = ?").bind(orderId).run();
    } else {
      // Insert new order with original created_at if available
      const result = await db
        .prepare(
          `INSERT INTO orders (order_number, client_name, client_phone, client_address, notes, total_amount, paid_amount, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(data.order_number, data.client_name, data.client_phone || null, data.client_address || null, data.notes || null, data.total_amount, data.paid_amount, user.id, data.created_at || new Date().toISOString())
        .run();
      orderId = result.meta.last_row_id as number;
    }

    // Insert items
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        await db
          .prepare(
            `INSERT INTO order_items (order_id, product_name, quantity, unit_price, discount, subtotal, method, deadline_date, status_work, status_send, status_payment, status_pickup, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(orderId, item.product_name, item.quantity, item.unit_price, item.discount, item.subtotal, item.method, item.deadline_date, item.status_work || null, item.status_send || null, item.status_payment || null, item.status_pickup || null, user.id)
          .run();
      }
    }

    imported++;
  }

  return c.json({
    success: true,
    imported,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
  });
});

// Get all orders with items
app.get("/", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const search = c.req.query("search") || "";
  const status = c.req.query("status") || "";
  const branch = c.req.query("branch") || "";

  let ordersQuery = `SELECT DISTINCT o.* FROM orders o`;
  const params: (string | number)[] = [];
  const conditions: string[] = [`o.user_id = ?`];
  params.push(user.id);

  // Join with order_items only when needed for filtering
  const needsItemsJoin = search || status;
  if (needsItemsJoin) {
    ordersQuery += ` LEFT JOIN order_items oi ON o.id = oi.order_id`;
  }

  if (search) {
    // Search in client_name OR any item's product_name
    conditions.push(`(o.client_name LIKE ? OR EXISTS (SELECT 1 FROM order_items oi2 WHERE oi2.order_id = o.id AND oi2.product_name LIKE ?))`);
    params.push(`%${search}%`, `%${search}%`);
  }

  if (status) {
    conditions.push(`(oi.status_work = ? OR oi.status_send = ? OR oi.status_pickup = ?)`);
    params.push(status, status, status);
  }

  if (branch) {
    if (branch === "none") {
      conditions.push(`o.branch_id IS NULL`);
    } else {
      conditions.push(`o.branch_id = ?`);
      params.push(parseInt(branch));
    }
  }

  ordersQuery += ` WHERE ` + conditions.join(` AND `);
  ordersQuery += ` ORDER BY o.created_at DESC`;

  const orders = await db.prepare(ordersQuery).bind(...params).all();

  // Get items for each order
  const ordersWithItems = await Promise.all(
    orders.results.map(async (order: Record<string, unknown>) => {
      const items = await db
        .prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC")
        .bind(order.id)
        .all();
      return { ...order, items: items.results };
    })
  );

  return c.json(ordersWithItems);
});

// Get single order with items
app.get("/:id", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const id = c.req.param("id");

  const order = await db
    .prepare("SELECT * FROM orders WHERE id = ? AND user_id = ?")
    .bind(id, user.id)
    .first();

  if (!order) {
    return c.json({ error: "Order not found" }, 404);
  }

  const items = await db
    .prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC")
    .bind(id)
    .all();

  return c.json({ ...order, items: items.results });
});

// Create order
app.post("/", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const body = await c.req.json();
  const parsed = CreateOrderSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const orderNumber = generateOrderNumber();
  const { client_name, client_phone, client_address, notes, discount, branch_id, total_amount, paid_amount } =
    parsed.data;

  const result = await db
    .prepare(
      `INSERT INTO orders (order_number, client_name, client_phone, client_address, notes, discount, branch_id, total_amount, paid_amount, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      orderNumber,
      client_name,
      client_phone || null,
      client_address || null,
      notes || null,
      discount || 0,
      branch_id || null,
      total_amount,
      paid_amount,
      user.id
    )
    .run();

  const newOrder = await db
    .prepare("SELECT * FROM orders WHERE id = ?")
    .bind(result.meta.last_row_id)
    .first();

  return c.json({ ...newOrder, items: [] }, 201);
});

// Update order
app.put("/:id", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = UpdateOrderSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const existing = await db
    .prepare("SELECT * FROM orders WHERE id = ? AND user_id = ?")
    .bind(id, user.id)
    .first();

  if (!existing) {
    return c.json({ error: "Order not found" }, 404);
  }

  const updates = parsed.data;
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  Object.entries(updates).forEach(([key, value]) => {
    fields.push(`${key} = ?`);
    values.push(value ?? null);
  });

  if (fields.length > 0) {
    fields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(Number(id));

    await db
      .prepare(`UPDATE orders SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  // Recalculate total if discount was updated
  if (updates.discount !== undefined) {
    await recalculateOrderTotal(db, Number(id));
  }

  const updated = await db
    .prepare("SELECT * FROM orders WHERE id = ?")
    .bind(id)
    .first();

  const items = await db
    .prepare("SELECT * FROM order_items WHERE order_id = ?")
    .bind(id)
    .all();

  return c.json({ ...updated, items: items.results });
});

// Delete order
app.delete("/:id", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const id = c.req.param("id");

  const existing = await db
    .prepare("SELECT * FROM orders WHERE id = ? AND user_id = ?")
    .bind(id, user.id)
    .first();

  if (!existing) {
    return c.json({ error: "Order not found" }, 404);
  }

  // Restore stock for all items before deleting
  const items = await db
    .prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?")
    .bind(id)
    .all();
  
  for (const item of items.results) {
    if (item.product_id) {
      await adjustProductStock(db, item.product_id as number, item.quantity as number);
    }
  }

  // Delete order items first
  await db.prepare("DELETE FROM order_items WHERE order_id = ?").bind(id).run();
  // Delete the order
  await db.prepare("DELETE FROM orders WHERE id = ?").bind(id).run();

  return c.json({ success: true });
});

// ============ ORDER ITEMS ============

// Add item to order
app.post("/:orderId/items", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const orderId = c.req.param("orderId");
  
  // Verify order belongs to user
  const order = await db
    .prepare("SELECT id FROM orders WHERE id = ? AND user_id = ?")
    .bind(orderId, user.id)
    .first();
    
  if (!order) {
    return c.json({ error: "Order not found" }, 404);
  }
  
  const body = await c.req.json();
  const parsed = CreateOrderItemSchema.safeParse({ ...body, order_id: Number(orderId) });

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const item = parsed.data;

  // Set default statuses based on method
  const statusWork = item.method === "cetak_sendiri" ? "belum_dikerjakan" : null;
  const statusSend = item.method === "tim_produksi" ? "belum_dikirim" : null;
  const statusPayment = item.method === "tim_produksi" ? "belum_bayar" : null;
  const statusPickup = item.method === "tim_produksi" ? "belum_diambil" : null;

  const result = await db
    .prepare(
      `INSERT INTO order_items 
       (order_id, product_id, product_name, quantity, unit_price, discount, subtotal, method, deadline_date, status_work, status_send, status_payment, status_pickup, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      item.order_id,
      item.product_id || null,
      item.product_name,
      item.quantity,
      item.unit_price,
      item.discount,
      item.subtotal,
      item.method,
      item.deadline_date,
      statusWork,
      statusSend,
      statusPayment,
      statusPickup,
      user.id
    )
    .run();

  // Reduce product stock
  await adjustProductStock(db, item.product_id, -item.quantity);

  // Recalculate order total
  await recalculateOrderTotal(db, Number(orderId));

  const newItem = await db
    .prepare("SELECT * FROM order_items WHERE id = ?")
    .bind(result.meta.last_row_id)
    .first();

  return c.json(newItem, 201);
});

// Update order item
app.put("/:orderId/items/:itemId", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const orderId = c.req.param("orderId");
  const itemId = c.req.param("itemId");
  
  // Verify order belongs to user
  const order = await db
    .prepare("SELECT id FROM orders WHERE id = ? AND user_id = ?")
    .bind(orderId, user.id)
    .first();
    
  if (!order) {
    return c.json({ error: "Order not found" }, 404);
  }
  
  const body = await c.req.json();
  const parsed = UpdateOrderItemSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const existing = await db
    .prepare("SELECT * FROM order_items WHERE id = ? AND order_id = ?")
    .bind(itemId, orderId)
    .first();

  if (!existing) {
    return c.json({ error: "Order item not found" }, 404);
  }

  const updates = parsed.data;
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value ?? null);
    }
  });

  if (fields.length > 0) {
    fields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(Number(itemId));

    await db
      .prepare(`UPDATE order_items SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();

    // Adjust stock if quantity changed
    if (updates.quantity !== undefined && existing.product_id) {
      const oldQuantity = existing.quantity as number;
      const newQuantity = updates.quantity;
      const quantityDiff = oldQuantity - newQuantity; // positive = stock restored, negative = more stock used
      await adjustProductStock(db, existing.product_id as number, quantityDiff);
    }

    // Recalculate order total if price/quantity/discount changed
    if (updates.quantity !== undefined || updates.unit_price !== undefined || updates.discount !== undefined || updates.subtotal !== undefined) {
      await recalculateOrderTotal(db, Number(orderId));
    }
  }

  const updated = await db
    .prepare("SELECT * FROM order_items WHERE id = ?")
    .bind(itemId)
    .first();

  return c.json(updated);
});

// Delete order item
app.delete("/:orderId/items/:itemId", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const orderId = c.req.param("orderId");
  const itemId = c.req.param("itemId");

  // Verify order belongs to user
  const order = await db
    .prepare("SELECT id FROM orders WHERE id = ? AND user_id = ?")
    .bind(orderId, user.id)
    .first();
    
  if (!order) {
    return c.json({ error: "Order not found" }, 404);
  }

  const existing = await db
    .prepare("SELECT * FROM order_items WHERE id = ? AND order_id = ?")
    .bind(itemId, orderId)
    .first();

  if (!existing) {
    return c.json({ error: "Order item not found" }, 404);
  }

  // Restore product stock
  if (existing.product_id) {
    await adjustProductStock(db, existing.product_id as number, existing.quantity as number);
  }

  await db.prepare("DELETE FROM order_items WHERE id = ?").bind(itemId).run();

  // Recalculate order total
  await recalculateOrderTotal(db, Number(orderId));

  return c.json({ success: true });
});

// Helper function to recalculate order total
async function recalculateOrderTotal(db: D1Database, orderId: number) {
  const items = await db
    .prepare("SELECT subtotal FROM order_items WHERE order_id = ?")
    .bind(orderId)
    .all();

  const itemsTotal = items.results.reduce(
    (sum, item: Record<string, unknown>) => sum + (Number(item.subtotal) || 0),
    0
  );

  // Get order discount
  const order = await db
    .prepare("SELECT discount FROM orders WHERE id = ?")
    .bind(orderId)
    .first();
  
  const orderDiscount = Number(order?.discount) || 0;
  const total = Math.max(0, itemsTotal - orderDiscount);

  await db
    .prepare("UPDATE orders SET total_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(total, orderId)
    .run();
}

// Helper function to adjust product stock
async function adjustProductStock(db: D1Database, productId: number | null | undefined, quantityChange: number) {
  if (!productId) return;
  
  await db
    .prepare("UPDATE products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(quantityChange, productId)
    .run();
}

export default app;
