/*
# Create expenses table

1. New Tables
   - `expenses`
     - `id` (bigint, auto-generated primary key)
     - `expense_type` (text, not null) - 'operasional' or 'vendor'
     - `description` (text, not null) - expense description
     - `amount` (bigint, not null) - expense amount in IDR
     - `expense_date` (date, not null) - date of expense
     - `vendor_name` (text, nullable) - vendor name for vendor expenses
     - `order_id` (bigint, nullable) - FK to orders if expense is tied to an order
     - `user_id` (uuid, not null, defaults to auth.uid()) - owner
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

2. Security
   - Enable RLS on `expenses`.
   - Owner-scoped CRUD for authenticated users.

3. Indexes
   - Index on expense_date for date-based queries
   - Index on user_id
*/

CREATE TABLE IF NOT EXISTS expenses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  expense_type text NOT NULL CHECK (expense_type IN ('operasional', 'vendor')),
  description text NOT NULL,
  amount bigint NOT NULL,
  expense_date date NOT NULL,
  vendor_name text,
  order_id bigint REFERENCES orders(id) ON DELETE SET NULL,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);

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
