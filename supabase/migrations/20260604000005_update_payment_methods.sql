ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'apple_cash';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'paypal';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'google_wallet';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'wise';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'chime';

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_payment_method_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_payment_method_check CHECK (payment_method IN ('zelle','cashapp','venmo','apple_pay','apple_cash','paypal','google_wallet','wise','chime'));

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_default_payment_method_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_default_payment_method_check CHECK (default_payment_method IS NULL OR default_payment_method IN ('zelle','cashapp','venmo','apple_pay','apple_cash','paypal','google_wallet','wise','chime'));
