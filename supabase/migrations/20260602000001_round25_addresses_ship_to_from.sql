-- Round 25 — Saved Addresses gain ship-to / ship-from kind flags
ALTER TABLE public.saved_addresses
  ADD COLUMN IF NOT EXISTS is_ship_to       BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_ship_from     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_default_from  BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.saved_addresses SET is_ship_to = TRUE WHERE is_ship_to IS NULL;

COMMENT ON COLUMN public.saved_addresses.is_ship_to IS
  'Address eligible to be selected as the SHIP-TO at checkout.';
COMMENT ON COLUMN public.saved_addresses.is_ship_from IS
  'Address eligible to be selected as the SHIP-FROM (return address / sender) when shipping packages.';
COMMENT ON COLUMN public.saved_addresses.is_default_from IS
  'Default ship-from address. is_default (legacy) is the default ship-to.';
