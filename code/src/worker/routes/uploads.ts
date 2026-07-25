import { Hono } from "hono";
import { authMiddleware } from "./auth";

const app = new Hono<{ Bindings: Env }>();

// All routes require authentication
app.use("/*", authMiddleware);

// Upload pickup photo
app.post("/pickup/:orderId", async (c) => {
  const user = c.get("user")!;
  const orderId = c.req.param("orderId");
  
  // Verify order belongs to user
  const db = c.env.DB;
  const order = await db
    .prepare("SELECT id FROM orders WHERE id = ? AND user_id = ?")
    .bind(orderId, user.id)
    .first();
  
  if (!order) {
    return c.json({ error: "Order not found" }, 404);
  }

  const formData = await c.req.formData();
  const file = formData.get("photo") as File;
  
  if (!file) {
    return c.json({ error: "No photo provided" }, 400);
  }

  const key = `pickups/${user.id}/${orderId}/${Date.now()}.jpg`;
  const arrayBuffer = await file.arrayBuffer();
  
  await c.env.R2_BUCKET.put(key, arrayBuffer, {
    httpMetadata: {
      contentType: file.type || "image/jpeg",
    },
  });

  return c.json({ key });
});

// Upload invoice screenshot
app.post("/invoice-screenshot", async (c) => {
  const user = c.get("user")!;
  
  const formData = await c.req.formData();
  const file = formData.get("image") as File;
  
  if (!file) {
    return c.json({ error: "No image provided" }, 400);
  }

  const key = `invoices/${user.id}/${Date.now()}.png`;
  const arrayBuffer = await file.arrayBuffer();
  
  await c.env.R2_BUCKET.put(key, arrayBuffer, {
    httpMetadata: {
      contentType: "image/png",
    },
  });

  // Return the full URL to access the image
  const url = `/api/uploads/invoice/${key}`;
  return c.json({ key, url });
});

// Get invoice screenshot
app.get("/invoice/:key{.+}", async (c) => {
  const key = c.req.param("key");
  
  const object = await c.env.R2_BUCKET.get(key);
  
  if (!object) {
    return c.json({ error: "Image not found" }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000");
  
  return c.body(object.body, { headers });
});

// Get pickup photo
app.get("/pickup/:key{.+}", async (c) => {
  const key = c.req.param("key");
  
  const object = await c.env.R2_BUCKET.get(key);
  
  if (!object) {
    return c.json({ error: "Photo not found" }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000");
  
  return c.body(object.body, { headers });
});

export default app;
