/*
# Create store_settings table

1. New Tables
   - `store_settings`
     - `id` (bigint, auto-generated primary key)
     - `name` (text, not null) - store name
     - `address` (text, nullable) - store address
     - `phone` (text, nullable) - store phone
     - `email` (text, nullable) - store email
     - `instagram` (text, nullable) - Instagram handle
     - `facebook` (text, nullable) - Facebook page
     - `admin_fee_qris` (numeric, nullable) - QRIS admin fee percentage
     - `admin_fee_va` (numeric, nullable) - Virtual Account admin fee
     - `admin_fee_ewallet` (numeric, nullable) - E-wallet admin fee
     - `admin_fee_cc` (numeric, nullable) - Credit card admin fee
     - `user_id` (uuid, not null, defaults to auth.uid()) - owner
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

2. Security
   - Enable RLS on `store_settings`.
   - Owner-scoped CRUD for authenticated users.
*/

CREATE TABLE IF NOT EXISTS store_settings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  address text,
  phone text,
  email text,
  instagram text,
  facebook text,
  admin_fee_qris numeric,
  admin_fee_va numeric,
  admin_fee_ewallet numeric,
  admin_fee_cc numeric,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_store_settings_user_id ON store_settings(user_id);

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
