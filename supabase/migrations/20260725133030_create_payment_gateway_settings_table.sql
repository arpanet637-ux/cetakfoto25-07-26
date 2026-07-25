/*
# Create payment_gateway_settings table

1. New Tables
   - `payment_gateway_settings`
     - `id` (bigint, auto-generated primary key)
     - `pin_hash` (text, nullable) - hashed PIN for gateway access
     - `doku_client_id` (text, nullable) - DOKU payment gateway client ID
     - `doku_secret_key` (text, nullable) - DOKU secret key
     - `doku_environment` (text, default 'sandbox') - 'sandbox' or 'production'
     - `user_id` (uuid, not null, defaults to auth.uid()) - owner
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

2. Security
   - Enable RLS on `payment_gateway_settings`.
   - Owner-scoped CRUD for authenticated users.
*/

CREATE TABLE IF NOT EXISTS payment_gateway_settings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pin_hash text,
  doku_client_id text,
  doku_secret_key text,
  doku_environment text DEFAULT 'sandbox' CHECK (doku_environment IS NULL OR doku_environment IN ('sandbox', 'production')),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE payment_gateway_settings ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_payment_gateway_settings_user_id ON payment_gateway_settings(user_id);

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
