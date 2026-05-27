-- Migration to add 'shipping' role to user_role ENUM
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'shipping';
