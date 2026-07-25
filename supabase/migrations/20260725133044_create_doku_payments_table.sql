/*
# Create doku_payments table

1. New Tables
   - `doku_payments`
     - `id` (bigint, auto-generated primary key)
     - `order_id` (bigint, not null) - FK to orders
     - `invoice_number` (text, not null) - DOKU invoice number
     - `amount` (bigint, not null) - base payment amount
     - `admin_fee` (bigint, not null) - admin fee charged
     - `total_amount` (bigint, not null) - total including admin fee
     - `status` (text, default 'pending') - payment status
     - `doku_invoice_id` (text, nullable) - DOKU's invoice reference
     - `payment_method` (text, nullable) - method used (QRIS, VA, etc.)
     - `user_id` (uuid, not null, defaults to auth.uid()) - owner
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

2. Security
   - Enable RLS on `doku_payments`.
   - Owner-scoped CRUD for authenticated users.

3. Indexes
   - Index on order_id
   - Index on user_id
*/

CREATE TABLE IF NOT EXISTS doku_payments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id bigint NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  amount bigint NOT NULL,
  admin_fee bigint NOT NULL DEFAULT 0,
  total_amount bigint NOT NULL,
  status text DEFAULT 'pending',
  doku_invoice_id text,
  payment_method text,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE doku_payments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_doku_payments_order_id ON doku_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_doku_payments_user_id ON doku_payments(user_id);

DROP POLICY IF EXISTS "select_own_doku_payments" ON doku_payments;
CREATE POLICY "select_own_doku_payments" ON doku_payments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_doku_payments" ON doku_payments;
CREATE POLICY "insert_own_doku_payments" ON doku_payments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_doku_payments" ON doku_payments;
CREATE POLICY "update_own_doku_payments" ON doku_payments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_doku_payments" ON doku_payments;
CREATE POLICY "delete_own_doku_payments" ON doku_payments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
