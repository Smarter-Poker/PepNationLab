-- bind_storefront_referral(): the ONLY sanctioned way for the storefront
-- signup route to move a brand-new researcher off the house-agent default.
--
-- WHY THIS EXISTS
--   auth.users INSERT fires handle_new_user(), which creates the profiles row
--   with role='researcher'. trg_00_ensure_researcher_house_agent then stamps
--   referring_agent_id with the 'researchstore' house agent on the way in.
--   By the time /api/storefront/register runs its own upsert, carrying the
--   real referring agent makes that upsert an UPDATE house -> agent, which
--   enforce_researcher_agent_binding rejects with SQLSTATE 23000. The route
--   then rolled back the auth user and returned 500, so EVERY storefront
--   signup that resolved to a real agent failed.
--
--   The sanctioned escape hatch is the transaction-local GUC
--   app.allow_researcher_reassign, already used by apply_signup_referral and
--   oauth_link_fresh_referral. This function follows the same pattern and is
--   deliberately narrow: it only touches a researcher younger than 15 minutes
--   whose attribution is still NULL / house / already the target, and only
--   when the target is a live agent, super_agent or admin. It can therefore
--   never re-point an established researcher.

create or replace function public.bind_storefront_referral(
  p_user_id uuid,
  p_agent_id uuid,
  p_sub_agent_id uuid default null
) returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_updated int;
  v_house uuid;
begin
  if p_user_id is null or p_agent_id is null then
    return false;
  end if;

  perform set_config('app.allow_researcher_reassign', 'on', true);

  select id into v_house
    from public.agent_profiles
   where slug = 'researchstore'
   limit 1;

  update public.profiles
     set referring_agent_id = p_agent_id,
         referring_sub_agent_id = coalesce(p_sub_agent_id, referring_sub_agent_id),
         updated_at = now()
   where id = p_user_id
     and role = 'researcher'
     and created_at > now() - interval '15 minutes'
     and (
           referring_agent_id is null
        or referring_agent_id = v_house
        or referring_agent_id = p_agent_id
     )
     and p_agent_id in (
           select id from public.profiles
            where role in ('agent', 'super_agent', 'admin')
              and is_active = true
     );

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$function$;

revoke all on function public.bind_storefront_referral(uuid, uuid, uuid) from public;
revoke all on function public.bind_storefront_referral(uuid, uuid, uuid) from anon;
revoke all on function public.bind_storefront_referral(uuid, uuid, uuid) from authenticated;
grant execute on function public.bind_storefront_referral(uuid, uuid, uuid) to service_role;
