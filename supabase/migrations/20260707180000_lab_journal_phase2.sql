-- Lab Journal Phase 2 Tables

-- 1. Researcher Inventory
CREATE TABLE researcher_inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  on_hand NUMERIC DEFAULT 1,
  lot_number TEXT,
  expiration_date TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_researcher_inventory_user_id ON researcher_inventory(user_id);
CREATE UNIQUE INDEX idx_researcher_inventory_user_product ON researcher_inventory(user_id, product_id);

ALTER TABLE researcher_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Researchers can manage their own inventory"
  ON researcher_inventory FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Researcher Scheduled Protocols
CREATE TABLE researcher_scheduled_protocols (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  compound_slug TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  frequency TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_researcher_scheduled_protocols_user_id ON researcher_scheduled_protocols(user_id);

ALTER TABLE researcher_scheduled_protocols ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Researchers can manage their own scheduled protocols"
  ON researcher_scheduled_protocols FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Add injection_site to researcher_doses
ALTER TABLE researcher_doses
ADD COLUMN injection_site TEXT;
