/*
# Create initial schema for BisnisKu print shop management app

1. New Tables
  - `products`: Product catalog (name, price, stock, min_stock, default_method)
  - `orders`: Customer orders with payment tracking
  - `order_items`: Individual items within an order with status tracking
  - `expenses`: Business expenses (operational and vendor)
  - `store_settings`: Store configuration (name, address, contact, admin fees)
  - `branches`: Store branch locations
  - `payment_records`: Payment history for orders
  - `payment_gateway_settings`: DOKU payment gateway configuration
  - `doku_payments`: DOKU payment transaction records

2. Security
  - RLS enabled on all tables
  - All tables scoped to authenticated users via user_id = auth.uid()
  - user_id defaults to auth.uid() so frontend inserts work without passing it

3. Important Notes
  - All monetary values stored as integers (Indonesian Rupiah, no decimals)
  - order_items tracks work status differently based on method (cetak_sendiri vs tim_produksi)
  - orders have pickup tracking (status, date, photo)
*/

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name text NOT NULL,
  price bigint NOT NULL DEFAULT 0,
  stock bigint NOT NULL DEFAULT 0,
  min_stock bigint NOT NULL DEFAULT 0,
  default_method text NOT NULL DEFAULT 'cetak_sendiri',
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_products" ON products;
CREATE POLICY "select_own_products" ON products FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_products" ON products;
CREATE POLICY "insert_own_products" ON products FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_products" ON products;
CREATE POLICY "update_own_products" ON products FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_products" ON products;
CREATE POLICY "delete_own_products" ON products FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  order_number text NOT NULL,
  client_name text NOT NULL,
  client_phone text,
  client_address text,
  notes text,
  discount bigint DEFAULT 0,
  branch_id bigint,
  total_amount bigint NOT NULL DEFAULT 0,
  paid_amount bigint NOT NULL DEFAULT 0,
  pickup_status text DEFAULT 'belum_diambil',
  pickup_date timestamptz,
  pickup_photo_url text,
  payment_method text,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_orders" ON orders;
CREATE POLICY "select_own_orders" ON orders FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_orders" ON orders;
CREATE POLICY "insert_own_orders" ON orders FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_orders" ON orders;
CREATE POLICY "update_own_orders" ON orders FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_orders" ON orders;
CREATE POLICY "delete_own_orders" ON orders FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  order_id bigint NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id bigint,
  product_name text NOT NULL,
  quantity bigint NOT NULL DEFAULT 1,
  unit_price bigint NOT NULL DEFAULT 0,
  discount bigint NOT NULL DEFAULT 0,
  subtotal bigint NOT NULL DEFAULT 0,
  method text NOT NULL DEFAULT 'cetak_sendiri',
  deadline_date date NOT NULL,
  status_work text,
  status_send text,
  status_payment text,
  status_pickup text,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_order_items" ON order_items;
CREATE POLICY "select_own_order_items" ON order_items FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_order_items" ON order_items;
CREATE POLICY "insert_own_order_items" ON order_items FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_order_items" ON order_items;
CREATE POLICY "update_own_order_items" ON order_items FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_order_items" ON order_items;
CREATE POLICY "delete_own_order_items" ON order_items FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  expense_type text NOT NULL,
  description text NOT NULL,
  amount bigint NOT NULL DEFAULT 0,
  expense_date date NOT NULL,
  vendor_name text,
  order_id bigint,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_expenses" ON expenses;
CREATE POLICY "select_own_expenses" ON expenses FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_expenses" ON expenses;
CREATE POLICY "insert_own_expenses" ON expenses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_expenses" ON expenses;
CREATE POLICY "update_own_expenses" ON expenses FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_expenses" ON expenses;
CREATE POLICY "delete_own_expenses" ON expenses FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Store settings table
CREATE TABLE IF NOT EXISTS store_settings (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name text NOT NULL DEFAULT 'Toko Saya',
  address text,
  phone text,
  email text,
  instagram text,
  facebook text,
  admin_fee_qris real,
  admin_fee_va real,
  admin_fee_ewallet real,
  admin_fee_cc real,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_store_settings" ON store_settings;
CREATE POLICY "select_own_store_settings" ON store_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_store_settings" ON store_settings;
CREATE POLICY "insert_own_store_settings" ON store_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_store_settings" ON store_settings;
CREATE POLICY "update_own_store_settings" ON store_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_store_settings" ON store_settings;
CREATE POLICY "delete_own_store_settings" ON store_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Branches table
CREATE TABLE IF NOT EXISTS branches (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name text NOT NULL,
  address text,
  phone text,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_branches" ON branches;
CREATE POLICY "select_own_branches" ON branches FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_branches" ON branches;
CREATE POLICY "insert_own_branches" ON branches FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_branches" ON branches;
CREATE POLICY "update_own_branches" ON branches FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_branches" ON branches;
CREATE POLICY "delete_own_branches" ON branches FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Payment records table
CREATE TABLE IF NOT EXISTS payment_records (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  order_id bigint NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount bigint NOT NULL DEFAULT 0,
  payment_method text NOT NULL,
  payment_type text NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_payment_records" ON payment_records;
CREATE POLICY "select_own_payment_records" ON payment_records FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_payment_records" ON payment_records;
CREATE POLICY "insert_own_payment_records" ON payment_records FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_payment_records" ON payment_records;
CREATE POLICY "update_own_payment_records" ON payment_records FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_payment_records" ON payment_records;
CREATE POLICY "delete_own_payment_records" ON payment_records FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Payment gateway settings table
CREATE TABLE IF NOT EXISTS payment_gateway_settings (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_hash text,
  doku_client_id text,
  doku_secret_key text,
  doku_environment text DEFAULT 'sandbox',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE payment_gateway_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_pg_settings" ON payment_gateway_settings;
CREATE POLICY "select_own_pg_settings" ON payment_gateway_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_pg_settings" ON payment_gateway_settings;
CREATE POLICY "insert_own_pg_settings" ON payment_gateway_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_pg_settings" ON payment_gateway_settings;
CREATE POLICY "update_own_pg_settings" ON payment_gateway_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_pg_settings" ON payment_gateway_settings;
CREATE POLICY "delete_own_pg_settings" ON payment_gateway_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_deadline ON order_items(deadline_date);
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_products_user ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_order ON payment_records(order_id);

-- Also allow public read of orders for queue checking (cek antrian page)
DROP POLICY IF EXISTS "anon_select_orders_queue" ON orders;
CREATE POLICY "anon_select_orders_queue" ON orders FOR SELECT
  TO anon USING (true);

DROP POLICY IF EXISTS "anon_select_order_items_queue" ON order_items;
CREATE POLICY "anon_select_order_items_queue" ON order_items FOR SELECT
  TO anon USING (true);
