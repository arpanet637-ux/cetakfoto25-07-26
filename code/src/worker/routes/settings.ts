import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import { UpdateStoreSettingsSchema } from "@/shared/types";

const app = new Hono<{ Bindings: Env }>();

// Apply auth middleware to all routes
app.use("/*", authMiddleware);

// Get store settings
app.get("/", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  
  let settings = await db
    .prepare("SELECT * FROM store_settings WHERE user_id = ? LIMIT 1")
    .bind(user.id)
    .first();

  // If no settings exist for this user, create default
  if (!settings) {
    await db
      .prepare(
        `INSERT INTO store_settings (name, address, phone, email, instagram, facebook, user_id)
         VALUES ('Nama Toko', '', '', '', '', '', ?)`
      )
      .bind(user.id)
      .run();
    settings = await db
      .prepare("SELECT * FROM store_settings WHERE user_id = ? LIMIT 1")
      .bind(user.id)
      .first();
  }

  return c.json(settings);
});

// Update store settings
app.put("/", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const body = await c.req.json();
  const parsed = UpdateStoreSettingsSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  // Ensure settings exist for this user
  let settings = await db
    .prepare("SELECT * FROM store_settings WHERE user_id = ? LIMIT 1")
    .bind(user.id)
    .first();

  if (!settings) {
    await db
      .prepare(
        `INSERT INTO store_settings (name, address, phone, email, instagram, facebook, user_id)
         VALUES ('Nama Toko', '', '', '', '', '', ?)`
      )
      .bind(user.id)
      .run();
    settings = await db
      .prepare("SELECT * FROM store_settings WHERE user_id = ? LIMIT 1")
      .bind(user.id)
      .first();
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
    values.push(String((settings as Record<string, unknown>).id));

    await db
      .prepare(`UPDATE store_settings SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  const updated = await db
    .prepare("SELECT * FROM store_settings WHERE user_id = ? LIMIT 1")
    .bind(user.id)
    .first();

  return c.json(updated);
});

export default app;
