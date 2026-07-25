/*
# Create payment_records table

1. New Tables
   - `payment_records`
     - `id` (bigint, auto-generated primary key)
     - `order_id` (bigint, not null) - FK to orders
     - `amount` (bigint, not null) - payment amount in IDR
     - `payment_method` (text, not null) - 'cash' or 'transfer'
     - `payment_type` (text, not null) - 'dp' or 'pelunasan'
     - `user_id` (uuid, not null, defaults to auth.uid()) - owner
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

2. Security
   - Enable RLS on `payment_records`.
   - Owner-scoped CRUD for authenticated users.

3. Indexes
   - Index on order_id for looking up payments per order
   - Index on user_id
*/

CREATE TABLE IF NOT EXISTS payment_records (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id bigint NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount bigint NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'transfer')),
  payment_type text NOT NULL CHECK (payment_type IN ('dp', 'pelunasan')),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_payment_records_order_id ON payment_records(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_user_id ON payment_records(user_id);

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
