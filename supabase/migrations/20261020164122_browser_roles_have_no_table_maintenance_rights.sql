-- Browser roles use Data API row operations. They never need SQL table
-- maintenance or structure privileges. RLS does not protect TRUNCATE.
-- Read-only audit 2026-10-20 found anon TRUNCATE on 175 public base tables and
-- authenticated TRUNCATE on 176; all 180 base tables already have RLS.
-- This changes no row, policy, function, normal DML or service-role privilege.
-- Atomic fail-closed verification preserves the complete preimage DML matrix.
-- Rollback requires the captured per-table ACL preimage; never GRANT ALL to
-- undo this migration, because that would widen tables with narrower grants.
-- Read-only live pg_default_acl confirms postgres/public browser structural
-- defaults. Remove only those four rights; retain default DML/service rights
-- and every other owner/schema/object-type default exactly. Other owners
-- (including supabase_admin/public) are explicitly outside this correction.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';
DO $access$
DECLARE
  v_defaults_before jsonb; v_defaults_after jsonb;
  v_default_service_before jsonb; v_default_service_after jsonb;
  v_before jsonb;
  v_after jsonb;
  v_service_before jsonb;
  v_service_after jsonb;
BEGIN
  IF current_setting('server_version_num')::integer < 170000 THEN
    RAISE EXCEPTION 'PostgreSQL 17 or later is required for MAINTAIN privilege verification';
  END IF;
  SELECT jsonb_agg(jsonb_build_array(c.oid,r.role,p.privilege,
      has_table_privilege(r.role,c.oid,p.privilege)) ORDER BY c.oid,r.role,p.privilege)
    INTO v_before
    FROM pg_class c CROSS JOIN (VALUES('anon'),('authenticated'),('service_role')) r(role)
    CROSS JOIN (VALUES('SELECT'),('INSERT'),('UPDATE'),('DELETE')) p(privilege)
   WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p','v','m','f');
  SELECT jsonb_agg(jsonb_build_array(c.oid,p.privilege,
      has_table_privilege('service_role',c.oid,p.privilege)) ORDER BY c.oid,p.privilege)
    INTO v_service_before
    FROM pg_class c CROSS JOIN (VALUES('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) p(privilege)
   WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p','v','m','f');

SELECT jsonb_agg(jsonb_build_array(d.defaclrole,d.defaclnamespace,d.defaclobjtype,a.grantor,a.grantee,a.privilege_type,a.is_grantable)
      ORDER BY d.defaclrole,d.defaclnamespace,d.defaclobjtype,a.grantor,a.grantee,a.privilege_type,a.is_grantable)
    INTO v_defaults_before FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
   WHERE NOT (d.defaclrole='postgres'::regrole::oid AND d.defaclnamespace='public'::regnamespace
     AND d.defaclobjtype='r' AND a.grantee IN (0,'anon'::regrole::oid,'authenticated'::regrole::oid)
     AND a.privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'));
  SELECT jsonb_agg(jsonb_build_array(x.defaclrole,x.defaclnamespace,x.defaclobjtype,x.privilege_type)
      ORDER BY x.defaclrole,x.defaclnamespace,x.defaclobjtype,x.privilege_type)
    INTO v_default_service_before FROM (
      SELECT DISTINCT d.defaclrole,d.defaclnamespace,d.defaclobjtype,a.privilege_type
        FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
       WHERE a.grantee=0 OR pg_has_role('service_role',a.grantee,'USAGE')
    ) x;

    REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON ALL TABLES IN SCHEMA public
    FROM PUBLIC, anon, authenticated;
  ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLES FROM PUBLIC, anon, authenticated;

  SELECT jsonb_agg(jsonb_build_array(d.defaclrole,d.defaclnamespace,d.defaclobjtype,a.grantor,a.grantee,a.privilege_type,a.is_grantable)
      ORDER BY d.defaclrole,d.defaclnamespace,d.defaclobjtype,a.grantor,a.grantee,a.privilege_type,a.is_grantable)
    INTO v_defaults_after FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
   WHERE NOT (d.defaclrole='postgres'::regrole::oid AND d.defaclnamespace='public'::regnamespace
     AND d.defaclobjtype='r' AND a.grantee IN (0,'anon'::regrole::oid,'authenticated'::regrole::oid)
     AND a.privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'));
  SELECT jsonb_agg(jsonb_build_array(x.defaclrole,x.defaclnamespace,x.defaclobjtype,x.privilege_type)
      ORDER BY x.defaclrole,x.defaclnamespace,x.defaclobjtype,x.privilege_type)
    INTO v_default_service_after FROM (
      SELECT DISTINCT d.defaclrole,d.defaclnamespace,d.defaclobjtype,a.privilege_type
        FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
       WHERE a.grantee=0 OR pg_has_role('service_role',a.grantee,'USAGE')
    ) x;
  IF v_defaults_before IS DISTINCT FROM v_defaults_after
     OR v_default_service_before IS DISTINCT FROM v_default_service_after THEN
    RAISE EXCEPTION 'Unexpected default DML/service/other-owner/schema ACL change; nothing may commit';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
    WHERE d.defaclrole='postgres'::regrole::oid AND d.defaclobjtype='r'
      AND d.defaclnamespace IN (0,'public'::regnamespace::oid)
      AND (a.grantee=0 OR pg_has_role('anon',a.grantee,'USAGE') OR pg_has_role('authenticated',a.grantee,'USAGE'))
      AND a.privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN')) THEN
    RAISE EXCEPTION 'Postgres public future-table structural defaults remain; review inherited/global source';
  END IF;


  SELECT jsonb_agg(jsonb_build_array(c.oid,r.role,p.privilege,
      has_table_privilege(r.role,c.oid,p.privilege)) ORDER BY c.oid,r.role,p.privilege)
    INTO v_after
    FROM pg_class c CROSS JOIN (VALUES('anon'),('authenticated'),('service_role')) r(role)
    CROSS JOIN (VALUES('SELECT'),('INSERT'),('UPDATE'),('DELETE')) p(privilege)
   WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p','v','m','f');
  SELECT jsonb_agg(jsonb_build_array(c.oid,p.privilege,
      has_table_privilege('service_role',c.oid,p.privilege)) ORDER BY c.oid,p.privilege)
    INTO v_service_after
    FROM pg_class c CROSS JOIN (VALUES('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) p(privilege)
   WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p','v','m','f');
  IF v_before IS DISTINCT FROM v_after OR v_service_before IS DISTINCT FROM v_service_after THEN
    RAISE EXCEPTION 'Normal API or service-role privileges changed; nothing may commit';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c CROSS JOIN (VALUES('anon'),('authenticated')) r(role)
     WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p','v','m','f')
       AND (has_table_privilege(r.role,c.oid,'TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
         OR has_any_column_privilege(r.role,c.oid,'REFERENCES'))
  ) THEN
    RAISE EXCEPTION 'A browser role retains inherited or column structural privileges; review its source';
  END IF;
END $access$;
COMMIT;
