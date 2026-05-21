-- ============================================
-- PEP NATION LAB — Initial Schema Migration
-- Migration: 001_initial_schema
-- ============================================
-- IMPORTANT: Run this ONLY on pepnationlab-prod Supabase project
-- NEVER run on Smarter.Poker databases

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE user_role AS ENUM ('researcher', 'agent', 'super_agent', 'admin');
CREATE TYPE agent_tier AS ENUM ('tier_1', 'tier_2', 'tier_3');
CREATE TYPE account_type AS ENUM ('credit', 'prepaid');
CREATE TYPE order_status AS ENUM (
  'pending_customer_payment',
  'agent_approval_pending',
  'approved_ship',
  'approved_pickup',
  'in_fulfillment',
  'shipped',
  'delivered',
  'cancelled'
);
CREATE TYPE fulfillment_method AS ENUM ('ship', 'agent_pickup');
CREATE TYPE payment_method AS ENUM ('zelle', 'cashapp', 'venmo', 'apple_pay');
CREATE TYPE discount_type AS ENUM ('percent', 'fixed');
CREATE TYPE statement_status AS ENUM ('open', 'pending_payment', 'paid');
CREATE TYPE disclaimer_layer AS ENUM ('site_entry', 'registration', 'add_to_cart', 'checkout');
CREATE TYPE tier_name AS ENUM ('tier_1', 'tier_2', 'tier_3');

-- ============================================
-- PROFILES
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'researcher',
  tier agent_tier,
  referring_agent_id UUID REFERENCES profiles(id),
  parent_agent_id UUID REFERENCES profiles(id),
  account_type account_type,
  prepaid_balance NUMERIC(10,2) DEFAULT 0,
  credit_limit NUMERIC(10,2),
  disclaimer_v1_accepted BOOLEAN DEFAULT FALSE,
  disclaimer_accepted_at TIMESTAMPTZ,
  disclaimer_ip TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AGENT PROFILES (Storefront config)
-- ============================================
CREATE TABLE agent_profiles (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  tagline TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#00C4BC',
  secondary_color TEXT DEFAULT '#0A1018',
  bio TEXT,
  qr_code_url TEXT,
  payment_handles JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enforce slug format: lowercase alphanumeric + hyphens only
ALTER TABLE agent_profiles 
  ADD CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9\-]+$'),
  ADD CONSTRAINT slug_length CHECK (length(slug) BETWEEN 2 AND 50);

-- ============================================
-- PRICING TIERS (Admin configurable)
-- ============================================
CREATE TABLE pricing_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tier_name tier_name UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  multiplier NUMERIC(4,2) NOT NULL DEFAULT 6.0,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default tiers
INSERT INTO pricing_tiers (tier_name, display_name, multiplier, description) VALUES
  ('tier_1', 'Tier 1 — Premium', 5.0, 'Best pricing for top-performing agents'),
  ('tier_2', 'Tier 2 — Standard', 6.0, 'Standard pricing for established agents'),
  ('tier_3', 'Tier 3 — Entry',   7.0, 'Entry pricing for new agents');

-- ============================================
-- PRODUCTS (Master catalog)
-- ============================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  base_cost NUMERIC(10,2) NOT NULL, -- PepNationLab's COGS
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  is_banned BOOLEAN DEFAULT FALSE, -- For BAC water, needles etc — permanently banned
  weight_oz NUMERIC(6,2) DEFAULT 0.5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent banned products from being sold
CREATE OR REPLACE FUNCTION prevent_banned_product_sale()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT is_banned FROM products WHERE id = NEW.product_id) THEN
    RAISE EXCEPTION 'This product is permanently banned from sale on PepNationLab';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PRODUCT TIER OVERRIDES
-- ============================================
CREATE TABLE product_tier_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tier_name tier_name NOT NULL,
  custom_multiplier NUMERIC(4,2) NOT NULL,
  UNIQUE(product_id, tier_name)
);

-- ============================================
-- AGENT PRODUCTS (Agent's storefront catalog)
-- ============================================
CREATE TABLE agent_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL, -- NULL = custom product
  custom_name TEXT,
  custom_description TEXT,
  custom_image_url TEXT,
  retail_price NUMERIC(10,2) NOT NULL,
  is_visible BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to block banned products
CREATE TRIGGER check_banned_product
  BEFORE INSERT OR UPDATE ON agent_products
  FOR EACH ROW
  WHEN (NEW.product_id IS NOT NULL)
  EXECUTE FUNCTION prevent_banned_product_sale();

-- ============================================
-- SHIPPING RATES
-- ============================================
CREATE TABLE shipping_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  min_weight_oz NUMERIC(6,2) NOT NULL DEFAULT 0,
  max_weight_oz NUMERIC(6,2) NOT NULL,
  rate NUMERIC(8,2) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default shipping tiers
INSERT INTO shipping_rates (name, min_weight_oz, max_weight_oz, rate) VALUES
  ('Under 1oz',  0,    1,   8.00),
  ('1oz - 4oz',  1,    4,  12.00),
  ('4oz - 8oz',  4,    8,  16.00),
  ('8oz - 16oz', 8,   16,  20.00),
  ('Over 16oz',  16, 9999, 28.00);

-- ============================================
-- ORDERS
-- ============================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id UUID NOT NULL REFERENCES profiles(id),
  agent_id UUID REFERENCES profiles(id), -- NULL = direct PNL order
  status order_status NOT NULL DEFAULT 'pending_customer_payment',
  fulfillment_method fulfillment_method,
  payment_method payment_method NOT NULL,
  shipping_address JSONB,
  shipping_cost NUMERIC(10,2) DEFAULT 0,
  subtotal NUMERIC(10,2) NOT NULL,
  total NUMERIC(10,2) NOT NULL,
  tracking_number TEXT,
  agent_approved_at TIMESTAMPTZ,
  agent_approval_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  agent_product_id UUID REFERENCES agent_products(id),
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL, -- snapshot
  quantity INT NOT NULL DEFAULT 1,
  unit_retail_price NUMERIC(10,2) NOT NULL,
  unit_cost_price NUMERIC(10,2) NOT NULL, -- agent's tier price
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- WEEKLY STATEMENTS
-- ============================================
CREATE TABLE weekly_statements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES profiles(id),
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  total_cogs NUMERIC(10,2) DEFAULT 0,
  total_shipping NUMERIC(10,2) DEFAULT 0,
  total_owed NUMERIC(10,2) DEFAULT 0,
  status statement_status DEFAULT 'open',
  paid_at TIMESTAMPTZ,
  payment_method TEXT,
  payment_reference TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, week_start)
);

CREATE TABLE statement_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  statement_id UUID NOT NULL REFERENCES weekly_statements(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  UNIQUE(statement_id, order_id)
);

-- ============================================
-- COUPONS
-- ============================================
CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  discount_type discount_type NOT NULL,
  discount_value NUMERIC(10,2) NOT NULL,
  min_order_amount NUMERIC(10,2),
  max_uses INT,
  uses_count INT DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, code)
);

-- ============================================
-- MESSAGES
-- ============================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES profiles(id),
  recipient_id UUID NOT NULL REFERENCES profiles(id),
  agent_context_id UUID REFERENCES profiles(id),
  subject TEXT,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DISCLAIMER AUDIT LOG
-- ============================================
CREATE TABLE disclaimer_acceptances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  session_id TEXT,
  disclaimer_version TEXT NOT NULL DEFAULT 'v1.0',
  layer disclaimer_layer NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  accepted_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_referring_agent ON profiles(referring_agent_id);
CREATE INDEX idx_agent_profiles_slug ON agent_profiles(slug);
CREATE INDEX idx_orders_buyer ON orders(buyer_id);
CREATE INDEX idx_orders_agent ON orders(agent_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_agent_products_agent ON agent_products(agent_id);
CREATE INDEX idx_weekly_statements_agent ON weekly_statements(agent_id);
CREATE INDEX idx_weekly_statements_week ON weekly_statements(week_start);
CREATE INDEX idx_disclaimer_acceptances_user ON disclaimer_acceptances(user_id);
CREATE INDEX idx_messages_recipient ON messages(recipient_id);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_agent_profiles_updated_at
  BEFORE UPDATE ON agent_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'researcher'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_tiers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE products              ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_tier_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_statements     ENABLE ROW LEVEL SECURITY;
ALTER TABLE statement_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons               ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE disclaimer_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_rates        ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = (SELECT auth.uid());
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT (SELECT role FROM profiles WHERE id = (SELECT auth.uid())) = 'admin';
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_agent_or_above()
RETURNS BOOLEAN AS $$
  SELECT (SELECT role FROM profiles WHERE id = (SELECT auth.uid())) IN ('agent', 'super_agent', 'admin');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- PROFILES policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (id = (SELECT auth.uid()));

CREATE POLICY "Agents can view their customers" ON profiles
  FOR SELECT USING (referring_agent_id = (SELECT auth.uid()));

CREATE POLICY "Admin can view all profiles" ON profiles
  FOR ALL USING (is_admin());

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (id = (SELECT auth.uid()));

CREATE POLICY "System can insert profile" ON profiles
  FOR INSERT WITH CHECK (id = (SELECT auth.uid()));

-- AGENT PROFILES policies
CREATE POLICY "Anyone can view active agent profiles" ON agent_profiles
  FOR SELECT USING (is_active = true);

CREATE POLICY "Agent can manage own profile" ON agent_profiles
  FOR ALL USING (id = (SELECT auth.uid()));

CREATE POLICY "Admin can manage all agent profiles" ON agent_profiles
  FOR ALL USING (is_admin());

-- PRICING TIERS — admin write, all can read
CREATE POLICY "Anyone can view pricing tiers" ON pricing_tiers
  FOR SELECT USING (true);

CREATE POLICY "Admin can manage pricing tiers" ON pricing_tiers
  FOR ALL USING (is_admin());

-- PRODUCTS — active products visible to all authed users
CREATE POLICY "Authed users can view active products" ON products
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL AND is_active = true AND is_banned = false);

CREATE POLICY "Admin can manage products" ON products
  FOR ALL USING (is_admin());

-- AGENT PRODUCTS — visible to customers of that agent + agent themselves
CREATE POLICY "Anyone can view visible agent products" ON agent_products
  FOR SELECT USING (is_visible = true);

CREATE POLICY "Agent can manage own products" ON agent_products
  FOR ALL USING (agent_id = (SELECT auth.uid()));

CREATE POLICY "Admin can manage all agent products" ON agent_products
  FOR ALL USING (is_admin());

-- ORDERS policies
CREATE POLICY "Buyers can view own orders" ON orders
  FOR SELECT USING (buyer_id = (SELECT auth.uid()));

CREATE POLICY "Agents can view their orders" ON orders
  FOR SELECT USING (agent_id = (SELECT auth.uid()));

CREATE POLICY "Buyers can create orders" ON orders
  FOR INSERT WITH CHECK (buyer_id = (SELECT auth.uid()));

CREATE POLICY "Agents can update their orders" ON orders
  FOR UPDATE USING (agent_id = (SELECT auth.uid()));

CREATE POLICY "Admin can manage all orders" ON orders
  FOR ALL USING (is_admin());

-- ORDER ITEMS policies
CREATE POLICY "Users can view items of own orders" ON order_items
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders WHERE buyer_id = (SELECT auth.uid()) OR agent_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Admin can view all order items" ON order_items
  FOR ALL USING (is_admin());

-- WEEKLY STATEMENTS policies
CREATE POLICY "Agents can view own statements" ON weekly_statements
  FOR SELECT USING (agent_id = (SELECT auth.uid()));

CREATE POLICY "Admin can manage all statements" ON weekly_statements
  FOR ALL USING (is_admin());

-- COUPONS policies
CREATE POLICY "Anyone can view active coupons (code lookup)" ON coupons
  FOR SELECT USING (is_active = true);

CREATE POLICY "Agents can manage own coupons" ON coupons
  FOR ALL USING (agent_id = (SELECT auth.uid()));

CREATE POLICY "Admin can manage all coupons" ON coupons
  FOR ALL USING (is_admin());

-- MESSAGES policies
CREATE POLICY "Users can view own messages" ON messages
  FOR SELECT USING (
    sender_id = (SELECT auth.uid()) OR recipient_id = (SELECT auth.uid())
  );

CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (sender_id = (SELECT auth.uid()));

-- DISCLAIMER ACCEPTANCES
CREATE POLICY "Users can insert own disclaimers" ON disclaimer_acceptances
  FOR INSERT WITH CHECK (true); -- Allow unauthenticated (site gate)

CREATE POLICY "Users can view own disclaimers" ON disclaimer_acceptances
  FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Admin can view all disclaimers" ON disclaimer_acceptances
  FOR SELECT USING (is_admin());

-- SHIPPING RATES — public read
CREATE POLICY "Anyone can view shipping rates" ON shipping_rates
  FOR SELECT USING (true);

CREATE POLICY "Admin can manage shipping rates" ON shipping_rates
  FOR ALL USING (is_admin());

-- PRODUCT TIER OVERRIDES
CREATE POLICY "Authed users can view tier overrides" ON product_tier_overrides
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "Admin can manage tier overrides" ON product_tier_overrides
  FOR ALL USING (is_admin());
