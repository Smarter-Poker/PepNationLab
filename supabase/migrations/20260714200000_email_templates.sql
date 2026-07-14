-- Email template overrides table.
-- Stores admin-edited subject/body copy for each transactional email key.
-- When an override exists, lib/email.ts uses the custom copy instead of the
-- hardcoded default. Structural pieces (buttons, code boxes, unsubscribe
-- links, order totals, the research-use-only footer) are always auto-inserted
-- by the template engine so an admin edit can never break a transactional email.

create table if not exists public.email_templates (
  template_key        text        primary key,
  label               text        not null,          -- human-readable name shown in admin
  description         text        not null default '', -- what this email does
  subject_override    text,                           -- null = use hardcoded default
  body_override       text,                           -- null = use hardcoded default
  available_vars      text[]      not null default '{}', -- placeholder chips shown in the UI
  updated_at          timestamptz,
  updated_by          uuid        references public.profiles(id) on delete set null
);

-- Seed the 13 template rows so the admin UI always has something to show.
insert into public.email_templates
  (template_key, label, description, available_vars)
values
  ('welcome',              'Welcome (House Store)',       'Sent to every new researcher who signs up directly on pepnationlab.com.',             array['{name}', '{username}']),
  ('welcome_agent',        'Welcome (Agent Store)',       'Sent to researchers who sign up through an agent''s referral link or QR code.',       array['{name}', '{username}', '{store}']),
  ('order_confirmation',   'Order Confirmed',             'Sent immediately when a researcher places an order.',                                  array['{name}', '{order}', '{total}']),
  ('order_approved',       'Order Approved',              'Sent when an admin or agent approves a pending order.',                                array['{name}', '{order}']),
  ('order_shipped',        'Order Shipped',               'Sent when an order is marked shipped and a tracking number is entered.',               array['{name}', '{order}', '{tracking}']),
  ('order_delivered',      'Order Delivered',             'Sent when an order status is updated to delivered.',                                   array['{name}', '{order}']),
  ('order_cancelled',      'Order Cancelled',             'Sent when an order is cancelled by an admin or agent.',                                array['{name}', '{order}']),
  ('product_alert',        'Product Alert',               'Sent when a product a researcher is watching comes back in stock or drops in price.',  array['{name}', '{product}']),
  ('verification_code',    'Email Verification Code',     'Sent during new account signup to verify the email address (6-digit code).',           array['{code}']),
  ('password_reset_link',  'Password Reset (Link)',       'Sent when a researcher requests a password reset via the forgot-password flow.',       array['{name}']),
  ('password_reset_code',  'Password Reset (Code)',       'Sent when a researcher requests a code-based password reset.',                         array['{name}', '{code}']),
  ('password_changed',     'Password Changed Alert',      'Security notice sent immediately after a password change.',                            array['{name}']),
  ('cart_recovery',        'Abandoned Cart Recovery',     'Managed separately in Admin → Cart Recovery. Edit copy there.',                        array['{name}'])
on conflict (template_key) do nothing;

-- RLS: table is only readable/writable by service_role (server-side).
-- No public access, no authenticated-user read — admin UI goes through API routes
-- that use createAdminClient() (service_role key).
alter table public.email_templates enable row level security;

-- No policies = deny all via PostgREST (service_role bypasses RLS).
-- This is intentional: the only path to this table is the admin API routes.

comment on table public.email_templates is
  'Admin-editable overrides for every transactional email sent by lib/email.ts. '
  'Null subject_override/body_override means use the built-in hardcoded default.';
