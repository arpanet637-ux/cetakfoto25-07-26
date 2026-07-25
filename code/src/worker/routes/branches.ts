import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import { CreateBranchSchema, UpdateBranchSchema } from "@/shared/types";

const app = new Hono<{ Bindings: Env }>();

// Apply auth middleware to all routes
app.use("/*", authMiddleware);

// Get all branches
app.get("/", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  
  const branches = await db
    .prepare("SELECT * FROM branches WHERE user_id = ? ORDER BY name ASC")
    .bind(user.id)
    .all();
  
  return c.json(branches.results);
});

// Get single branch
app.get("/:id", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const id = parseInt(c.req.param("id"));
  
  const branch = await db
    .prepare("SELECT * FROM branches WHERE id = ? AND user_id = ?")
    .bind(id, user.id)
    .first();
  
  if (!branch) {
    return c.json({ error: "Branch not found" }, 404);
  }
  
  return c.json(branch);
});

// Create branch
app.post("/", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const body = await c.req.json();
  
  const parsed = CreateBranchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  
  const { name, address, phone } = parsed.data;
  
  const result = await db
    .prepare(
      `INSERT INTO branches (name, address, phone, user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    )
    .bind(name, address || null, phone || null, user.id)
    .run();
  
  const newBranch = await db
    .prepare("SELECT * FROM branches WHERE id = ?")
    .bind(result.meta.last_row_id)
    .first();
  
  return c.json(newBranch, 201);
});

// Update branch
app.put("/:id", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json();
  
  const parsed = UpdateBranchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  
  // Check if branch exists and belongs to user
  const existing = await db
    .prepare("SELECT * FROM branches WHERE id = ? AND user_id = ?")
    .bind(id, user.id)
    .first();
  
  if (!existing) {
    return c.json({ error: "Branch not found" }, 404);
  }
  
  const { name, address, phone } = parsed.data;
  
  await db
    .prepare(
      `UPDATE branches SET 
        name = COALESCE(?, name),
        address = COALESCE(?, address),
        phone = COALESCE(?, phone),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`
    )
    .bind(
      name || null,
      address !== undefined ? address : null,
      phone !== undefined ? phone : null,
      id,
      user.id
    )
    .run();
  
  const updated = await db
    .prepare("SELECT * FROM branches WHERE id = ?")
    .bind(id)
    .first();
  
  return c.json(updated);
});

// Delete branch
app.delete("/:id", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const id = parseInt(c.req.param("id"));
  
  // Check if branch exists and belongs to user
  const existing = await db
    .prepare("SELECT * FROM branches WHERE id = ? AND user_id = ?")
    .bind(id, user.id)
    .first();
  
  if (!existing) {
    return c.json({ error: "Branch not found" }, 404);
  }
  
  // Remove branch_id from orders that use this branch
  await db
    .prepare("UPDATE orders SET branch_id = NULL WHERE branch_id = ? AND user_id = ?")
    .bind(id, user.id)
    .run();
  
  await db
    .prepare("DELETE FROM branches WHERE id = ? AND user_id = ?")
    .bind(id, user.id)
    .run();
  
  return c.json({ success: true });
});

export default app;
