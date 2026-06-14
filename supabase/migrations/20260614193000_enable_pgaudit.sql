-- 20260614193000_enable_pgaudit.sql
-- Enables pgaudit for tamper-proof logging of DDL and Write operations by administrators

-- Create the extension in the extensions schema
CREATE EXTENSION IF NOT EXISTS "pgaudit" WITH SCHEMA "extensions";

-- Configure pgaudit to log writes (INSERT, UPDATE, DELETE) and DDL (CREATE, ALTER, DROP)
ALTER ROLE postgres SET pgaudit.log = 'write, ddl';
