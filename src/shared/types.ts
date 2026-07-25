import z from "zod";

// ============ PRODUCTS ============
export const ProductSchema = z.object({
  id: z.number(),
  name: z.string().min(1),
  price: z.number().int().min(0),
  stock: z.number().int().min(0),
  min_stock: z.number().int().min(0),
  default_method: z.enum(["cetak_sendiri", "tim_produksi"]),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreateProductSchema = ProductSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const UpdateProductSchema = CreateProductSchema.partial();

export type Product = z.infer<typeof ProductSchema>;
export type CreateProduct = z.infer<typeof CreateProductSchema>;
export type UpdateProduct = z.infer<typeof UpdateProductSchema>;

// ============ ORDERS ============
export const OrderSchema = z.object({
  id: z.number(),
  order_number: z.string(),
  client_name: z.string().min(1),
  client_phone: z.string().nullable(),
  client_address: z.string().nullable(),
  notes: z.string().nullable(),
  discount: z.number().int().nullable(),
  branch_id: z.number().int().nullable(),
  total_amount: z.number().int(),
  paid_amount: z.number().int(),
  pickup_status: z.enum(["belum_diambil", "sudah_diambil"]).nullable(),
  pickup_date: z.string().nullable(),
  pickup_photo_key: z.string().nullable(),
  payment_method: z.enum(["cash", "transfer"]).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreateOrderSchema = OrderSchema.omit({
  id: true,
  order_number: true,
  created_at: true,
  updated_at: true,
}).extend({
  // Make these optional for creation - they have sensible defaults
  pickup_status: z.enum(["belum_diambil", "sudah_diambil"]).nullable().optional(),
  pickup_date: z.string().nullable().optional(),
  pickup_photo_key: z.string().nullable().optional(),
  payment_method: z.enum(["cash", "transfer"]).nullable().optional(),
});

export const UpdateOrderSchema = CreateOrderSchema.partial();

export type Order = z.infer<typeof OrderSchema>;
export type CreateOrder = z.infer<typeof CreateOrderSchema>;
export type UpdateOrder = z.infer<typeof UpdateOrderSchema>;

// ============ ORDER ITEMS ============
export const OrderItemSchema = z.object({
  id: z.number(),
  order_id: z.number(),
  product_id: z.number().nullable(),
  product_name: z.string().min(1),
  quantity: z.number().int().min(1),
  unit_price: z.number().int().min(0),
  discount: z.number().int().min(0),
  subtotal: z.number().int(),
  method: z.enum(["cetak_sendiri", "tim_produksi"]),
  deadline_date: z.string(),
  // Status for "cetak_sendiri"
  status_work: z.enum(["belum_dikerjakan", "sedang_dikerjakan", "selesai"]).nullable(),
  // Status for "tim_produksi"
  status_send: z.enum(["belum_dikirim", "sudah_dikirim"]).nullable(),
  status_payment: z.enum(["belum_bayar", "sudah_bayar"]).nullable(),
  status_pickup: z.enum(["belum_diambil", "sudah_diambil"]).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreateOrderItemSchema = OrderItemSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  status_work: true,
  status_send: true,
  status_payment: true,
  status_pickup: true,
}).extend({
  status_work: z.enum(["belum_dikerjakan", "sedang_dikerjakan", "selesai"]).nullable().optional(),
  status_send: z.enum(["belum_dikirim", "sudah_dikirim"]).nullable().optional(),
  status_payment: z.enum(["belum_bayar", "sudah_bayar"]).nullable().optional(),
  status_pickup: z.enum(["belum_diambil", "sudah_diambil"]).nullable().optional(),
});

export const UpdateOrderItemSchema = CreateOrderItemSchema.partial();

export type OrderItem = z.infer<typeof OrderItemSchema>;
export type CreateOrderItem = z.infer<typeof CreateOrderItemSchema>;
export type UpdateOrderItem = z.infer<typeof UpdateOrderItemSchema>;

// Order with items combined
export type OrderWithItems = Order & { items: OrderItem[] };

// ============ EXPENSES ============
export const ExpenseSchema = z.object({
  id: z.number(),
  expense_type: z.enum(["operasional", "vendor"]),
  description: z.string().min(1),
  amount: z.number().int().min(0),
  expense_date: z.string(),
  vendor_name: z.string().nullable(),
  order_id: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreateExpenseSchema = ExpenseSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const UpdateExpenseSchema = CreateExpenseSchema.partial();

export type Expense = z.infer<typeof ExpenseSchema>;
export type CreateExpense = z.infer<typeof CreateExpenseSchema>;
export type UpdateExpense = z.infer<typeof UpdateExpenseSchema>;

// ============ STORE SETTINGS ============
export const StoreSettingsSchema = z.object({
  id: z.number(),
  name: z.string().min(1),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  instagram: z.string().nullable(),
  facebook: z.string().nullable(),
  admin_fee_qris: z.number().nullable(),
  admin_fee_va: z.number().nullable(),
  admin_fee_ewallet: z.number().nullable(),
  admin_fee_cc: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const UpdateStoreSettingsSchema = StoreSettingsSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial();

export type StoreSettings = z.infer<typeof StoreSettingsSchema>;
export type UpdateStoreSettings = z.infer<typeof UpdateStoreSettingsSchema>;

// ============ BRANCHES ============
export const BranchSchema = z.object({
  id: z.number(),
  name: z.string().min(1),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreateBranchSchema = BranchSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const UpdateBranchSchema = CreateBranchSchema.partial();

export type Branch = z.infer<typeof BranchSchema>;
export type CreateBranch = z.infer<typeof CreateBranchSchema>;
export type UpdateBranch = z.infer<typeof UpdateBranchSchema>;

// ============ PAYMENT RECORDS ============
export const PaymentRecordSchema = z.object({
  id: z.number(),
  order_id: z.number(),
  amount: z.number().int().min(0),
  payment_method: z.enum(["cash", "transfer"]),
  payment_type: z.enum(["dp", "pelunasan"]),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreatePaymentRecordSchema = PaymentRecordSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type PaymentRecord = z.infer<typeof PaymentRecordSchema>;
export type CreatePaymentRecord = z.infer<typeof CreatePaymentRecordSchema>;

// ============ DASHBOARD STATS ============
export interface DashboardStats {
  totalActiveOrders: number;
  pendingVendor: number;
  deadlineToday: number;
  monthlyRevenue: number;
  revenueGrowth: number;
}

export interface DeadlineNotification {
  id: number;
  order_id: number;
  order_number: string;
  client_name: string;
  product_name: string;
  method: string;
  status: string;
  deadline_date: string;
}

export interface StockNotification {
  id: number;
  name: string;
  stock: number;
  min_stock: number;
}

// ============ PAYMENT GATEWAY SETTINGS ============
export const PaymentGatewaySettingsSchema = z.object({
  id: z.number(),
  has_pin: z.boolean(),
  doku_client_id: z.string().nullable(),
  doku_secret_key: z.string().nullable(),
  doku_environment: z.enum(["sandbox", "production"]).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const SetPinSchema = z.object({
  pin: z.string().min(4).max(6),
});

export const VerifyPinSchema = z.object({
  pin: z.string().min(4).max(6),
});

export const UpdatePaymentGatewaySchema = z.object({
  pin: z.string().min(4).max(6),
  doku_client_id: z.string().nullable().optional(),
  doku_secret_key: z.string().nullable().optional(),
  doku_environment: z.enum(["sandbox", "production"]).nullable().optional(),
});

export type PaymentGatewaySettings = z.infer<typeof PaymentGatewaySettingsSchema>;
export type SetPin = z.infer<typeof SetPinSchema>;
export type VerifyPin = z.infer<typeof VerifyPinSchema>;
export type UpdatePaymentGateway = z.infer<typeof UpdatePaymentGatewaySchema>;
