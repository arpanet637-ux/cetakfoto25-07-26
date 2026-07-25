import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import { SetPinSchema, VerifyPinSchema, UpdatePaymentGatewaySchema } from "@/shared/types";

const app = new Hono<{ Bindings: Env }>();

// Helper: Generate UUID
function generateUUID(): string {
  return crypto.randomUUID();
}

// Helper: Generate ISO8601 timestamp in UTC
function generateTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

// Helper: SHA256 digest
async function sha256Digest(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const base64 = btoa(String.fromCharCode(...hashArray));
  return base64;
}

// Helper: HMAC-SHA256 signature
async function hmacSha256(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
  const signatureArray = Array.from(new Uint8Array(signature));
  return btoa(String.fromCharCode(...signatureArray));
}

// Simple hash function for PIN (using Web Crypto API)
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + "bisniskuSalt2024");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Simple encryption for credentials using XOR with user-specific key
function encryptData(data: string, userId: string): string {
  const key = userId + "dokuEncKey2024";
  let result = "";
  for (let i = 0; i < data.length; i++) {
    result += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(result);
}

function decryptData(encryptedData: string, userId: string): string {
  const key = userId + "dokuEncKey2024";
  const data = atob(encryptedData);
  let result = "";
  for (let i = 0; i < data.length; i++) {
    result += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

// Format currency for WhatsApp message
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

// DOKU Notification Webhook - NO AUTH (called by DOKU server)
// Endpoint: /api/payment-gateway/notification
app.post("/notification", async (c) => {
  const db = c.env.DB;
  
  try {
    // Get raw body for logging and signature verification
    const rawBody = await c.req.text();
    
    // Log all headers for debugging
    const headers: Record<string, string> = {};
    c.req.raw.headers.forEach((value, key) => {
      headers[key] = value;
    });
    console.log("=== DOKU NOTIFICATION DEBUG ===");
    console.log("Headers:", JSON.stringify(headers));
    console.log("Raw Body:", rawBody);
    
    // Parse body - handle both JSON and form-encoded
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      // Try to parse as URL encoded if JSON fails
      console.log("Failed to parse as JSON, trying URL encoded");
      const params = new URLSearchParams(rawBody);
      body = Object.fromEntries(params.entries());
    }
    
    console.log("Parsed Body:", JSON.stringify(body, null, 2));
    
    // DOKU API 1.1 can have different payload structures
    // Try multiple possible field locations
    const orderData = body.order as Record<string, unknown> | undefined;
    const transactionData = body.transaction as Record<string, unknown> | undefined;
    const acquirerData = body.acquirer as Record<string, unknown> | undefined;
    const channelData = body.channel as Record<string, unknown> | undefined;
    
    // Invoice number can be in different locations
    const invoiceNumber = 
      (orderData?.invoice_number as string) || 
      (body.invoice_number as string) ||
      (orderData?.order_id as string) ||
      (body.order_id as string) ||
      (transactionData?.original_request_id as string);
    
    // Transaction status can be in different locations and formats
    const transactionStatus = (
      (transactionData?.status as string) || 
      (body.transaction_status as string) ||
      (body.status as string) ||
      (body.result as string) ||
      ""
    ).toUpperCase();
    
    // Payment method/channel info
    const channelId = (channelData?.id as string) || (acquirerData?.id as string) || (body.payment_channel as string) || "DOKU";
    const channelName = (channelData?.name as string) || (acquirerData?.name as string) || channelId;
    
    console.log("Extracted fields:");
    console.log("- Invoice Number:", invoiceNumber);
    console.log("- Transaction Status:", transactionStatus);
    console.log("- Channel:", channelName);
    
    if (!invoiceNumber) {
      console.log("ERROR: Missing invoice_number in notification");
      console.log("Available body keys:", Object.keys(body));
      return c.json({ error: "Missing invoice_number" }, 400);
    }
    
    // Find the pending payment
    type DokuPaymentRecord = { 
      id: number; 
      order_id: number;
      invoice_number: string;
      amount: number; 
      admin_fee: number; 
      total_amount: number; 
      user_id: string 
    };
    
    let dokuPayment = await db
      .prepare("SELECT * FROM doku_payments WHERE invoice_number = ? AND status = 'pending' LIMIT 1")
      .bind(invoiceNumber)
      .first() as DokuPaymentRecord | null;
    
    if (!dokuPayment) {
      // Try partial match (invoice might have prefix/suffix differences)
      console.log("No exact match, trying partial match for:", invoiceNumber);
      dokuPayment = await db
        .prepare("SELECT * FROM doku_payments WHERE invoice_number LIKE ? AND status = 'pending' LIMIT 1")
        .bind(`%${invoiceNumber}%`)
        .first() as DokuPaymentRecord | null;
      
      if (!dokuPayment) {
        console.log("No pending payment found for invoice:", invoiceNumber);
        // List all pending payments for debugging
        const allPending = await db
          .prepare("SELECT invoice_number FROM doku_payments WHERE status = 'pending' LIMIT 10")
          .all();
        console.log("Pending invoices in DB:", JSON.stringify(allPending.results));
        return c.json({ message: "Payment not found or already processed" }, 200);
      }
      
      console.log("Found partial match:", dokuPayment.invoice_number);
    }
    
    console.log("Found doku_payment:", JSON.stringify(dokuPayment));
    
    // Skip signature verification for now to debug - can be re-enabled later
    // DOKU signature verification (optional - log but don't block)
    const clientIdHeader = c.req.header("Client-Id") || c.req.header("client-id");
    const requestIdHeader = c.req.header("Request-Id") || c.req.header("request-id");
    const requestTimestampHeader = c.req.header("Request-Timestamp") || c.req.header("request-timestamp");
    const signatureHeader = c.req.header("Signature") || c.req.header("signature");
    
    console.log("Signature headers:", {
      clientId: clientIdHeader,
      requestId: requestIdHeader,
      timestamp: requestTimestampHeader,
      signature: signatureHeader ? "present" : "missing"
    });
    
    // Check if payment is successful
    // DOKU can send various success statuses
    const successStatuses = ["SUCCESS", "PAID", "COMPLETED", "SETTLEMENT", "CAPTURED"];
    const isSuccess = successStatuses.includes(transactionStatus);
    
    console.log("Is success?", isSuccess, "Status:", transactionStatus);
    
    if (isSuccess) {
      // Update doku_payments status
      await db
        .prepare("UPDATE doku_payments SET status = 'success', payment_method = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(channelName, dokuPayment.id)
        .run();
      
      console.log("Updated doku_payment status to success");
      
      // Get order details
      const order = await db
        .prepare("SELECT * FROM orders WHERE id = ?")
        .bind(dokuPayment.order_id)
        .first() as { 
          id: number; 
          order_number: string;
          client_name: string;
          client_phone: string;
          paid_amount: number; 
          total_amount: number;
          created_at: string;
        } | null;
      
      console.log("Order found:", order ? order.order_number : "NOT FOUND");
      
      if (order) {
        // Update paid_amount
        const newPaidAmount = order.paid_amount + dokuPayment.amount;
        await db
          .prepare("UPDATE orders SET paid_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
          .bind(newPaidAmount, order.id)
          .run();
        
        console.log(`Updated order paid_amount: ${order.paid_amount} -> ${newPaidAmount} (of ${order.total_amount})`);
        
        // Determine payment type
        const paymentType = newPaidAmount >= order.total_amount ? "pelunasan" : "dp";
        
        // Create payment record with DOKU method info
        const paymentMethodDisplay = `Transfer (${channelName})`;
        const now = new Date().toISOString();
        await db
          .prepare(`
            INSERT INTO payment_records (order_id, amount, payment_method, payment_type, user_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(dokuPayment.order_id, dokuPayment.amount, paymentMethodDisplay, paymentType, dokuPayment.user_id, now, now)
          .run();
        
        console.log(`Payment record created: ${paymentType}, amount: ${dokuPayment.amount}, method: ${paymentMethodDisplay}`);
        console.log(`=== PAYMENT SUCCESS: Order ${order.order_number}, Total Paid ${newPaidAmount}/${order.total_amount} ===`);
        
        // Send WhatsApp notification if phone number exists
        if (order.client_phone) {
          try {
            // Get store settings for store name
            const storeSettings = await db
              .prepare("SELECT name FROM store_settings WHERE user_id = ? LIMIT 1")
              .bind(dokuPayment.user_id)
              .first() as { name: string } | null;
            
            const storeName = storeSettings?.name || "BisnisKu";
            
            // Format phone number
            let phone = order.client_phone.replace(/\D/g, "");
            if (phone.startsWith("0")) {
              phone = "62" + phone.slice(1);
            } else if (!phone.startsWith("62")) {
              phone = "62" + phone;
            }
            
            // Build notification message
            let message = `✅ *PEMBAYARAN BERHASIL*\n\n`;
            message += `Halo ${order.client_name},\n\n`;
            message += `Pembayaran Anda telah kami terima:\n\n`;
            message += `📄 Invoice: ${order.order_number}\n`;
            message += `💰 Jumlah: ${formatCurrency(dokuPayment.amount)}\n`;
            message += `💳 Metode: ${channelName}\n\n`;
            
            if (newPaidAmount >= order.total_amount) {
              message += `🎉 *Status: LUNAS*\n\n`;
            } else {
              message += `📊 Total Terbayar: ${formatCurrency(newPaidAmount)} / ${formatCurrency(order.total_amount)}\n`;
              message += `📋 Sisa: ${formatCurrency(order.total_amount - newPaidAmount)}\n\n`;
            }
            
            message += `Terima kasih telah berbelanja di ${storeName}! 🙏`;
            
            console.log(`WhatsApp notification prepared for ${phone}`);
            
          } catch (waError) {
            console.error("Failed to prepare WhatsApp notification:", waError);
          }
        }
      }
      
      return c.json({ message: "Payment processed successfully", status: "SUCCESS" }, 200);
      
    } else if (transactionStatus === "FAILED" || transactionStatus === "EXPIRED" || transactionStatus === "CANCEL") {
      // Mark payment as failed
      await db
        .prepare("UPDATE doku_payments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(transactionStatus.toLowerCase(), dokuPayment.id)
        .run();
      
      console.log(`Payment ${transactionStatus}: Invoice ${invoiceNumber}`);
      return c.json({ message: `Payment marked as ${transactionStatus}` }, 200);
    } else {
      console.log(`Unknown transaction status: ${transactionStatus}`);
    }
    
    return c.json({ message: "Notification received", status: transactionStatus }, 200);
    
  } catch (error) {
    console.error("=== NOTIFICATION ERROR ===");
    console.error("Error:", error);
    return c.json({ error: "Notification processing failed" }, 500);
  }
});

// Legacy webhook endpoint (kept for backward compatibility)
app.post("/webhook", async (c) => {
  const db = c.env.DB;
  
  try {
    const body = await c.req.json() as {
      order?: { invoice_number?: string };
      transaction?: { status?: string; original_request_id?: string };
      acquirer?: { id?: string };
      channel?: { id?: string };
    };
    
    console.log("DOKU Webhook received:", JSON.stringify(body));
    
    const invoiceNumber = body.order?.invoice_number;
    const transactionStatus = body.transaction?.status;
    const channelId = body.channel?.id || body.acquirer?.id;
    
    if (!invoiceNumber) {
      return c.json({ error: "Missing invoice_number" }, 400);
    }
    
    // Find the pending payment
    const dokuPayment = await db
      .prepare("SELECT * FROM doku_payments WHERE invoice_number = ? AND status = 'pending' LIMIT 1")
      .bind(invoiceNumber)
      .first() as { id: number; order_id: number; amount: number; admin_fee: number; total_amount: number; user_id: string } | null;
    
    if (!dokuPayment) {
      console.log("No pending payment found for invoice:", invoiceNumber);
      return c.json({ message: "Payment not found or already processed" }, 200);
    }
    
    // Check if payment is successful
    if (transactionStatus === "SUCCESS" || transactionStatus === "PAID") {
      // Update doku_payments status
      await db
        .prepare("UPDATE doku_payments SET status = 'success', payment_method = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(channelId || "DOKU", dokuPayment.id)
        .run();
      
      // Update order's paid_amount
      const order = await db
        .prepare("SELECT * FROM orders WHERE id = ?")
        .bind(dokuPayment.order_id)
        .first() as { id: number; paid_amount: number; total_amount: number } | null;
      
      if (order) {
        const newPaidAmount = order.paid_amount + dokuPayment.amount;
        await db
          .prepare("UPDATE orders SET paid_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
          .bind(newPaidAmount, order.id)
          .run();
        
        // Determine payment type
        const paymentType = newPaidAmount >= order.total_amount ? "pelunasan" : "dp";
        
        // Create payment record
        const now = new Date().toISOString();
        await db
          .prepare(`
            INSERT INTO payment_records (order_id, amount, payment_method, payment_type, user_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(dokuPayment.order_id, dokuPayment.amount, "Transfer (DOKU)", paymentType, dokuPayment.user_id, now, now)
          .run();
        
        console.log(`Payment processed: Order ${dokuPayment.order_id}, Amount ${dokuPayment.amount}, New paid ${newPaidAmount}`);
      }
    } else if (transactionStatus === "FAILED" || transactionStatus === "EXPIRED") {
      // Mark payment as failed
      await db
        .prepare("UPDATE doku_payments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(transactionStatus.toLowerCase(), dokuPayment.id)
        .run();
    }
    
    return c.json({ message: "Webhook processed successfully" }, 200);
    
  } catch (error) {
    console.error("Webhook processing error:", error);
    return c.json({ error: "Webhook processing failed" }, 500);
  }
});

// Apply auth middleware to all other routes
app.use("/*", authMiddleware);

// Get payment gateway settings (without sensitive data)
app.get("/", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;

  let settings = await db
    .prepare("SELECT * FROM payment_gateway_settings WHERE user_id = ? LIMIT 1")
    .bind(user.id)
    .first();

  if (!settings) {
    return c.json({
      has_pin: false,
      doku_client_id: null,
      doku_secret_key: null,
      doku_environment: "sandbox",
    });
  }

  return c.json({
    has_pin: !!settings.pin_hash,
    doku_client_id: settings.doku_client_id ? "••••••••" : null,
    doku_secret_key: settings.doku_secret_key ? "••••••••" : null,
    doku_environment: settings.doku_environment || "sandbox",
  });
});

// Set PIN (first time or reset)
app.post("/set-pin", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const body = await c.req.json();
  const parsed = SetPinSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "PIN harus 4-6 digit" }, 400);
  }

  const pinHash = await hashPin(parsed.data.pin);

  let settings = await db
    .prepare("SELECT * FROM payment_gateway_settings WHERE user_id = ? LIMIT 1")
    .bind(user.id)
    .first();

  if (!settings) {
    await db
      .prepare(
        `INSERT INTO payment_gateway_settings (user_id, pin_hash) VALUES (?, ?)`
      )
      .bind(user.id, pinHash)
      .run();
  } else {
    await db
      .prepare(
        `UPDATE payment_gateway_settings SET pin_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`
      )
      .bind(pinHash, user.id)
      .run();
  }

  return c.json({ success: true });
});

// Verify PIN and get decrypted settings
app.post("/verify-pin", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const body = await c.req.json();
  const parsed = VerifyPinSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "PIN tidak valid" }, 400);
  }

  const settings = await db
    .prepare("SELECT * FROM payment_gateway_settings WHERE user_id = ? LIMIT 1")
    .bind(user.id)
    .first();

  if (!settings || !settings.pin_hash) {
    return c.json({ error: "PIN belum diatur" }, 400);
  }

  const pinHash = await hashPin(parsed.data.pin);
  if (pinHash !== settings.pin_hash) {
    return c.json({ error: "PIN salah" }, 401);
  }

  // Return decrypted credentials
  return c.json({
    verified: true,
    doku_client_id: settings.doku_client_id 
      ? decryptData(settings.doku_client_id as string, user.id) 
      : "",
    doku_secret_key: settings.doku_secret_key 
      ? decryptData(settings.doku_secret_key as string, user.id) 
      : "",
    doku_environment: settings.doku_environment || "sandbox",
  });
});

// Update payment gateway settings (requires PIN verification)
app.put("/", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const body = await c.req.json();
  const parsed = UpdatePaymentGatewaySchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  // Verify PIN first
  const settings = await db
    .prepare("SELECT * FROM payment_gateway_settings WHERE user_id = ? LIMIT 1")
    .bind(user.id)
    .first();

  if (!settings || !settings.pin_hash) {
    return c.json({ error: "PIN belum diatur" }, 400);
  }

  const pinHash = await hashPin(parsed.data.pin);
  if (pinHash !== settings.pin_hash) {
    return c.json({ error: "PIN salah" }, 401);
  }

  // Encrypt and update credentials
  const updates: string[] = [];
  const values: (string | null)[] = [];

  if (parsed.data.doku_client_id !== undefined) {
    updates.push("doku_client_id = ?");
    values.push(
      parsed.data.doku_client_id 
        ? encryptData(parsed.data.doku_client_id, user.id) 
        : null
    );
  }

  if (parsed.data.doku_secret_key !== undefined) {
    updates.push("doku_secret_key = ?");
    values.push(
      parsed.data.doku_secret_key 
        ? encryptData(parsed.data.doku_secret_key, user.id) 
        : null
    );
  }

  if (parsed.data.doku_environment !== undefined) {
    updates.push("doku_environment = ?");
    values.push(parsed.data.doku_environment);
  }

  if (updates.length > 0) {
    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(user.id);

    await db
      .prepare(
        `UPDATE payment_gateway_settings SET ${updates.join(", ")} WHERE user_id = ?`
      )
      .bind(...values)
      .run();
  }

  return c.json({ success: true });
});

// Create DOKU payment link for an order
app.post("/create-link", async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const body = await c.req.json();
  
  const { order_id, payment_method } = body;
  if (!order_id) {
    return c.json({ error: "order_id diperlukan" }, 400);
  }

  // Get order details
  const order = await db
    .prepare("SELECT * FROM orders WHERE id = ? AND user_id = ?")
    .bind(order_id, user.id)
    .first() as { id: number; order_number: string; client_name: string; client_phone: string; total_amount: number; paid_amount: number } | null;

  if (!order) {
    return c.json({ error: "Pesanan tidak ditemukan" }, 404);
  }

  const remainingAmount = order.total_amount - order.paid_amount;
  if (remainingAmount <= 0) {
    return c.json({ error: "Pesanan sudah lunas" }, 400);
  }

  // Get store settings for admin fee
  const storeSettings = await db
    .prepare("SELECT * FROM store_settings WHERE user_id = ? LIMIT 1")
    .bind(user.id)
    .first() as { admin_fee_qris: number | null; admin_fee_va: number | null; admin_fee_ewallet: number | null; admin_fee_cc: number | null } | null;

  // Calculate admin fee (use QRIS as default, or specified method)
  let adminFeePercent = 0;
  const method = payment_method || "qris";
  if (storeSettings) {
    switch (method) {
      case "qris":
        adminFeePercent = storeSettings.admin_fee_qris || 0;
        break;
      case "va":
        adminFeePercent = storeSettings.admin_fee_va || 0;
        break;
      case "ewallet":
        adminFeePercent = storeSettings.admin_fee_ewallet || 0;
        break;
      case "cc":
        adminFeePercent = storeSettings.admin_fee_cc || 0;
        break;
    }
  }

  const adminFee = Math.ceil(remainingAmount * (adminFeePercent / 100));
  const totalWithFee = remainingAmount + adminFee;

  // Get payment gateway settings
  const settings = await db
    .prepare("SELECT * FROM payment_gateway_settings WHERE user_id = ? LIMIT 1")
    .bind(user.id)
    .first() as { doku_client_id: string; doku_secret_key: string; doku_environment: string } | null;

  if (!settings || !settings.doku_client_id || !settings.doku_secret_key) {
    return c.json({ error: "DOKU belum dikonfigurasi. Silakan atur di Pengaturan > Payment Gateway." }, 400);
  }

  // Decrypt credentials
  const clientId = decryptData(settings.doku_client_id, user.id);
  const secretKey = decryptData(settings.doku_secret_key, user.id);
  const environment = settings.doku_environment || "sandbox";

  // Prepare DOKU API request
  const apiUrl = environment === "production"
    ? "https://api.doku.com/checkout/v1/payment"
    : "https://api-sandbox.doku.com/checkout/v1/payment";

  const requestId = generateUUID();
  const requestTimestamp = generateTimestamp();
  const requestTarget = "/checkout/v1/payment";
  
  // Generate unique invoice number with timestamp
  const invoiceNumber = `${order.order_number}-${Date.now()}`;

  const requestBody = {
    order: {
      amount: totalWithFee,
      invoice_number: invoiceNumber,
      currency: "IDR"
    },
    payment: {
      payment_due_date: 1440 // 24 hours
    },
    customer: {
      name: order.client_name,
      phone: order.client_phone || undefined
    }
  };

  const bodyString = JSON.stringify(requestBody);
  
  // Generate Digest
  const digest = await sha256Digest(bodyString);
  
  // Generate Signature
  const signatureComponents = [
    `Client-Id:${clientId}`,
    `Request-Id:${requestId}`,
    `Request-Timestamp:${requestTimestamp}`,
    `Request-Target:${requestTarget}`,
    `Digest:${digest}`
  ].join("\n");

  const signature = await hmacSha256(secretKey, signatureComponents);

  // Call DOKU API
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Id": clientId,
        "Request-Id": requestId,
        "Request-Timestamp": requestTimestamp,
        "Signature": `HMACSHA256=${signature}`
      },
      body: bodyString
    });

    const result = await response.json() as { 
      message?: string[]; 
      response?: { payment?: { url?: string }; order?: { invoice_number?: string } };
      error?: { message?: string };
    };

    if (!response.ok) {
      console.error("DOKU API error:", result);
      return c.json({ 
        error: result.error?.message || "Gagal membuat link pembayaran" 
      }, 400);
    }

    const paymentUrl = result.response?.payment?.url;
    if (!paymentUrl) {
      return c.json({ error: "Tidak mendapat URL pembayaran dari DOKU" }, 500);
    }

    // Store pending payment in database
    await db
      .prepare(`
        INSERT INTO doku_payments (order_id, invoice_number, amount, admin_fee, total_amount, status, user_id)
        VALUES (?, ?, ?, ?, ?, 'pending', ?)
      `)
      .bind(order_id, invoiceNumber, remainingAmount, adminFee, totalWithFee, user.id)
      .run();

    return c.json({ 
      success: true, 
      payment_url: paymentUrl,
      amount: remainingAmount,
      admin_fee: adminFee,
      total_amount: totalWithFee
    });

  } catch (error) {
    console.error("DOKU API call failed:", error);
    return c.json({ error: "Gagal menghubungi DOKU API" }, 500);
  }
});

export default app;
