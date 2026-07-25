import { Hono } from "hono";
import { cors } from "hono/cors";
import productsRoutes from "@/worker/routes/products";
import ordersRoutes from "@/worker/routes/orders";
import expensesRoutes from "@/worker/routes/expenses";
import settingsRoutes from "@/worker/routes/settings";
import dashboardRoutes from "@/worker/routes/dashboard";
import authRoutes from "@/worker/routes/auth";
import queueRoutes from "@/worker/routes/queue";
import branchesRoutes from "@/worker/routes/branches";
import uploadsRoutes from "@/worker/routes/uploads";
import paymentsRoutes from "@/worker/routes/payments";
import paymentGatewayRoutes from "@/worker/routes/payment-gateway";

const app = new Hono<{ Bindings: Env }>();

app.use("/*", cors());

// Mount routes
app.route("/api", authRoutes);
app.route("/api/products", productsRoutes);
app.route("/api/orders", ordersRoutes);
app.route("/api/expenses", expensesRoutes);
app.route("/api/settings", settingsRoutes);
app.route("/api/dashboard", dashboardRoutes);
app.route("/api/queue", queueRoutes);
app.route("/api/branches", branchesRoutes);
app.route("/api/uploads", uploadsRoutes);
app.route("/api/payments", paymentsRoutes);
app.route("/api/payment-gateway", paymentGatewayRoutes);

export default app;
