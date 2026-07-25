/*
# Create order_items table

1. New Tables
   - `order_items`
     - `id` (bigint, auto-generated primary key)
     - `order_id` (bigint, not null) - FK to orders
     - `product_id` (bigint, nullable) - FK to products (nullable for deleted products)
     - `product_name` (text, not null) - snapshot of product name at order time
     - `quantity` (bigint, not null) - item quantity
     - `unit_price` (bigint, not null) - price per unit at order time
     - `discount` (bigint, not null) - item-level discount
     - `subtotal` (bigint, not null) - computed subtotal
     - `method` (text, not null) - 'cetak_sendiri' or 'tim_produksi'
     - `deadline_date` (date, not null) - deadline for this item
     - `status_work` (text, nullable) - work status for cetak_sendiri items
     - `status_send` (text, nullable) - send status for tim_produksi items
     - `status_payment` (text, nullable) - payment status for tim_produksi items
     - `status_pickup` (text, nullable) - pickup status for tim_produksi items
     - `user_id` (uuid, not null, defaults to auth.uid()) - owner
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

2. Security
   - Enable RLS on `order_items`.
   - Owner-scoped CRUD for authenticated users.

3. Indexes
   - Index on order_id for joins
   - Index on deadline_date for deadline queries
*/

CREATE TABLE IF NOT EXISTS order_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id bigint NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id bigint REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity bigint NOT NULL,
  unit_price bigint NOT NULL,
  discount bigint NOT NULL DEFAULT 0,
  subtotal bigint NOT NULL,
  method text NOT NULL CHECK (method IN ('cetak_sendiri', 'tim_produksi')),
  deadline_date date NOT NULL,
  status_work text CHECK (status_work IS NULL OR status_work IN ('belum_dikerjakan', 'sedang_dikerjakan', 'selesai')),
  status_send text CHECK (status_send IS NULL OR status_send IN ('belum_dikirim', 'sudah_dikirim')),
  status_payment text CHECK (status_payment IS NULL OR status_payment IN ('belum_bayar', 'sudah_bayar')),
  status_pickup text CHECK (status_pickup IS NULL OR status_pickup IN ('belum_diambil', 'sudah_diambil')),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_deadline ON order_items(deadline_date);
CREATE INDEX IF NOT EXISTS idx_order_items_user_id ON order_items(user_id);

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
