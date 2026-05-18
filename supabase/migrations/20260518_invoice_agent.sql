-- Invoice Agent tables
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_billing_address TEXT,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  payment_terms TEXT NOT NULL DEFAULT 'Net 14',
  items JSONB NOT NULL DEFAULT '[]',
  discount NUMERIC DEFAULT 0,
  subtotal NUMERIC DEFAULT 0,
  tax NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  tax_rate NUMERIC DEFAULT 0.11,
  currency TEXT DEFAULT 'IDR',
  status TEXT CHECK (status IN ('draft','sent','paid','overdue','cancelled')) DEFAULT 'draft',
  notes TEXT,
  billed_by_name TEXT DEFAULT 'Studio Arsa Digital',
  billed_by_address TEXT DEFAULT 'Jl. Jamvu No 5, Semending, Malang',
  bank_name TEXT DEFAULT 'Bank Central Asia (BCA)',
  bank_account_name TEXT DEFAULT 'Studio Arsa Digital',
  bank_account_number TEXT DEFAULT '123 456 7890',
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  reminder_count INTEGER DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  resend_email_id TEXT,
  ai_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own invoices" ON invoices
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Super admin access all invoices" ON invoices
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_invoice_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_updated_at
BEFORE UPDATE ON invoices
FOR EACH ROW EXECUTE FUNCTION update_invoice_updated_at();
