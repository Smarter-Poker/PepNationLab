-- Add featured_products array to agent_profiles for the Storefront Conversion Kit
-- This allows agents to feature up to 4 existing catalog products on their storefront.
-- Agents can ONLY select existing products, they cannot add new custom products.

ALTER TABLE public.agent_profiles 
ADD COLUMN IF NOT EXISTS featured_products UUID[] DEFAULT '{}'::UUID[];

