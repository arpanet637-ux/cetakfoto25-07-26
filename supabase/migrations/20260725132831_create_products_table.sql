/*
# Create products table

1. New Tables
   - `products`
     - `id` (bigint, auto-generated primary key)
     - `name` (text, not null) - product name
     - `price` (bigint, not null) - price in IDR
     - `stock` (bigint, not null) - current stock count
     - `min_stock` (bigint, not null) - minimum stock threshold for alerts
     - `default_method` (text, not null) - either 'cetak_sendiri' or 'tim_produksi'
     - `user_id` (uuid, not null, defaults to auth.uid()) - owner
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

2. Security
   - Enable RLS on `products`.
   - Owner-scoped CRUD: each authenticated user can only access their own products.

3. Indexes
   - Index on user_id for fast filtering
   - Index on (stock, min_stock) for low-stock alerts
*/

CREATE TABLE IF NOT EXISTS products (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  price bigint NOT NULL,
  stock bigint NOT NULL DEFAULT 0,
  min_stock bigint NOT NULL DEFAULT 0,
  default_method text NOT NULL CHECK (default_method IN ('cetak_sendiri', 'tim_produksi')),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock, min_stock);

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
