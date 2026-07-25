import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import { CreateExpenseSchema, UpdateExpenseSchema } from "@/shared/types";

const app = new Hono<{ Bindings: Env }>();

// Apply auth middleware to all routes
app.use("/*", authMiddleware);

// Get all expenses
app.get("/", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const type = c.req.query("type");
  const startDate = c.req.query("start_date");
  const endDate = c.req.query("end_date");

  let query = "SELECT * FROM expenses WHERE user_id = ?";
  const params: string[] = [user.id];

  if (type) {
    query += " AND expense_type = ?";
    params.push(type);
  }

  if (startDate) {
    query += " AND expense_date >= ?";
    params.push(startDate);
  }

  if (endDate) {
    query += " AND expense_date <= ?";
    params.push(endDate);
  }

  query += " ORDER BY expense_date DESC";

  const expenses = await db.prepare(query).bind(...params).all();
  return c.json(expenses.results);
});

// Get single expense
app.get("/:id", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const id = c.req.param("id");
  
  const expense = await db
    .prepare("SELECT * FROM expenses WHERE id = ? AND user_id = ?")
    .bind(id, user.id)
    .first();

  if (!expense) {
    return c.json({ error: "Expense not found" }, 404);
  }
  return c.json(expense);
});

// Create expense
app.post("/", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const body = await c.req.json();
  const parsed = CreateExpenseSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { expense_type, description, amount, expense_date, vendor_name, order_id } =
    parsed.data;

  const result = await db
    .prepare(
      `INSERT INTO expenses (expense_type, description, amount, expense_date, vendor_name, order_id, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      expense_type,
      description,
      amount,
      expense_date,
      vendor_name || null,
      order_id || null,
      user.id
    )
    .run();

  const newExpense = await db
    .prepare("SELECT * FROM expenses WHERE id = ?")
    .bind(result.meta.last_row_id)
    .first();

  return c.json(newExpense, 201);
});

// Update expense
app.put("/:id", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = UpdateExpenseSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const existing = await db
    .prepare("SELECT * FROM expenses WHERE id = ? AND user_id = ?")
    .bind(id, user.id)
    .first();

  if (!existing) {
    return c.json({ error: "Expense not found" }, 404);
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
    values.push(Number(id));

    await db
      .prepare(`UPDATE expenses SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  const updated = await db
    .prepare("SELECT * FROM expenses WHERE id = ?")
    .bind(id)
    .first();

  return c.json(updated);
});

// Delete expense
app.delete("/:id", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const id = c.req.param("id");

  const existing = await db
    .prepare("SELECT * FROM expenses WHERE id = ? AND user_id = ?")
    .bind(id, user.id)
    .first();

  if (!existing) {
    return c.json({ error: "Expense not found" }, 404);
  }

  await db.prepare("DELETE FROM expenses WHERE id = ?").bind(id).run();

  return c.json({ success: true });
});

// Get expense summary
app.get("/summary/total", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const month = c.req.query("month"); // YYYY-MM format

  let query = `
    SELECT 
      expense_type,
      SUM(amount) as total
    FROM expenses
    WHERE user_id = ?
  `;

  const params: string[] = [user.id];

  if (month) {
    query += " AND strftime('%Y-%m', expense_date) = ?";
    params.push(month);
  }

  query += " GROUP BY expense_type";

  const summary = await db.prepare(query).bind(...params).all();

  const result = {
    operasional: 0,
    vendor: 0,
    total: 0,
  };

  summary.results.forEach((row: Record<string, unknown>) => {
    if (row.expense_type === "operasional") {
      result.operasional = Number(row.total) || 0;
    } else if (row.expense_type === "vendor") {
      result.vendor = Number(row.total) || 0;
    }
  });

  result.total = result.operasional + result.vendor;

  return c.json(result);
});

export default app;
