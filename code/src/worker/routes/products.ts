import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import { CreateProductSchema, UpdateProductSchema } from "@/shared/types";
import { z } from "zod";

const app = new Hono<{ Bindings: Env }>();

// Apply auth middleware to all routes
app.use("/*", authMiddleware);

// Export all products as JSON
app.get("/export", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  
  const products = await db
    .prepare("SELECT name, price, stock, min_stock, default_method FROM products WHERE user_id = ? ORDER BY name ASC")
    .bind(user.id)
    .all();
  
  const exportData = {
    type: "bisnisKu_products_backup",
    version: 1,
    exported_at: new Date().toISOString(),
    products: products.results,
  };

  return c.json(exportData);
});

// Import products from JSON
app.post("/import", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const body = await c.req.json();

  // Validate import format
  if (body.type !== "bisnisKu_products_backup") {
    return c.json({ error: "Format file tidak valid. Gunakan file backup produk dari BisnisKu." }, 400);
  }

  const ProductImportSchema = z.object({
    name: z.string().min(1),
    price: z.number().min(0),
    stock: z.number().min(0),
    min_stock: z.number().min(0),
    default_method: z.enum(["cetak_sendiri", "tim_produksi"]),
  });

  const products = body.products;
  if (!Array.isArray(products)) {
    return c.json({ error: "Data produk tidak valid." }, 400);
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const product of products) {
    const parsed = ProductImportSchema.safeParse(product);
    if (!parsed.success) {
      skipped++;
      errors.push(`Produk "${product.name || 'unknown'}": data tidak valid`);
      continue;
    }

    const { name, price, stock, min_stock, default_method } = parsed.data;

    // Check if product with same name exists for this user
    const existing = await db
      .prepare("SELECT id FROM products WHERE name = ? AND user_id = ?")
      .bind(name, user.id)
      .first();

    if (existing) {
      // Update existing product
      await db
        .prepare(
          `UPDATE products SET price = ?, stock = ?, min_stock = ?, default_method = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        )
        .bind(price, stock, min_stock, default_method, existing.id)
        .run();
    } else {
      // Insert new product
      await db
        .prepare(
          `INSERT INTO products (name, price, stock, min_stock, default_method, user_id) VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(name, price, stock, min_stock, default_method, user.id)
        .run();
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

// Get all products
app.get("/", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  
  const products = await db
    .prepare("SELECT * FROM products WHERE user_id = ? ORDER BY name ASC")
    .bind(user.id)
    .all();
  return c.json(products.results);
});

// Get single product
app.get("/:id", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const id = c.req.param("id");
  
  const product = await db
    .prepare("SELECT * FROM products WHERE id = ? AND user_id = ?")
    .bind(id, user.id)
    .first();

  if (!product) {
    return c.json({ error: "Product not found" }, 404);
  }
  return c.json(product);
});

// Create product
app.post("/", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const body = await c.req.json();
  const parsed = CreateProductSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { name, price, stock, min_stock, default_method } = parsed.data;

  const result = await db
    .prepare(
      `INSERT INTO products (name, price, stock, min_stock, default_method, user_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(name, price, stock, min_stock, default_method, user.id)
    .run();

  const newProduct = await db
    .prepare("SELECT * FROM products WHERE id = ?")
    .bind(result.meta.last_row_id)
    .first();

  return c.json(newProduct, 201);
});

// Update product
app.put("/:id", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = UpdateProductSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const existing = await db
    .prepare("SELECT * FROM products WHERE id = ? AND user_id = ?")
    .bind(id, user.id)
    .first();

  if (!existing) {
    return c.json({ error: "Product not found" }, 404);
  }

  const updates = parsed.data;
  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(updates.name);
  }
  if (updates.price !== undefined) {
    fields.push("price = ?");
    values.push(updates.price);
  }
  if (updates.stock !== undefined) {
    fields.push("stock = ?");
    values.push(updates.stock);
  }
  if (updates.min_stock !== undefined) {
    fields.push("min_stock = ?");
    values.push(updates.min_stock);
  }
  if (updates.default_method !== undefined) {
    fields.push("default_method = ?");
    values.push(updates.default_method);
  }

  if (fields.length > 0) {
    fields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    await db
      .prepare(`UPDATE products SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  const updated = await db
    .prepare("SELECT * FROM products WHERE id = ?")
    .bind(id)
    .first();

  return c.json(updated);
});

// Delete product
app.delete("/:id", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const id = c.req.param("id");

  const existing = await db
    .prepare("SELECT * FROM products WHERE id = ? AND user_id = ?")
    .bind(id, user.id)
    .first();

  if (!existing) {
    return c.json({ error: "Product not found" }, 404);
  }

  await db.prepare("DELETE FROM products WHERE id = ?").bind(id).run();

  return c.json({ success: true });
});

// Get low stock products
app.get("/alerts/low-stock", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  
  const products = await db
    .prepare("SELECT * FROM products WHERE user_id = ? AND stock <= min_stock ORDER BY stock ASC")
    .bind(user.id)
    .all();
  return c.json(products.results);
});

export default app;
