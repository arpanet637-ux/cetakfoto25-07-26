/*
# Create orders table

1. New Tables
   - `orders`
     - `id` (bigint, auto-generated primary key)
     - `order_number` (text, not null) - formatted order number like ORD-YYMMDD-XXX
     - `client_name` (text, not null) - customer name
     - `client_phone` (text, nullable) - customer phone
     - `client_address` (text, nullable) - customer address
     - `notes` (text, nullable) - order notes
     - `discount` (bigint, nullable) - discount amount in IDR
     - `branch_id` (bigint, nullable) - FK to branches table
     - `total_amount` (bigint, not null) - total order amount
     - `paid_amount` (bigint, not null) - amount paid so far
     - `pickup_status` (text, nullable) - 'belum_diambil' or 'sudah_diambil'
     - `pickup_date` (timestamptz, nullable) - when order was picked up
     - `pickup_photo_key` (text, nullable) - photo proof of pickup
     - `payment_method` (text, nullable) - 'cash' or 'transfer'
     - `user_id` (uuid, not null, defaults to auth.uid()) - owner
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

2. Security
   - Enable RLS on `orders`.
   - Owner-scoped CRUD for authenticated users.

3. Indexes
   - Index on user_id
   - Index on created_at for date-based queries
*/

CREATE TABLE IF NOT EXISTS orders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_number text NOT NULL,
  client_name text NOT NULL,
  client_phone text,
  client_address text,
  notes text,
  discount bigint DEFAULT 0,
  branch_id bigint REFERENCES branches(id) ON DELETE SET NULL,
  total_amount bigint NOT NULL,
  paid_amount bigint NOT NULL DEFAULT 0,
  pickup_status text DEFAULT 'belum_diambil' CHECK (pickup_status IS NULL OR pickup_status IN ('belum_diambil', 'sudah_diambil')),
  pickup_date timestamptz,
  pickup_photo_key text,
  payment_method text CHECK (payment_method IS NULL OR payment_method IN ('cash', 'transfer')),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

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
