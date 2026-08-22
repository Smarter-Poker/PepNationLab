-- Repo sync: the LIVE redeem_coupon already enforces starts_at and new_customers_only (updated
-- out-of-band after 20260706000000). Committing the live definition so the repo matches prod.
-- Audit finding M2 ("coupon starts_at/new_customers_only not enforced") was based on the stale
-- migration file; it is enforced in prod. No behavior change -- documentation/repro only.

CREATE OR REPLACE FUNCTION public.redeem_coupon(p_code text, p_agent_id uuid, p_order_subtotal numeric, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(coupon_id uuid, discount_type text, discount_value numeric, discount_amount numeric)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_coupon  public.coupons%rowtype;
  v_amount  numeric := 0;
  v_peruser integer;
  v_pct     numeric;
begin
  select * into v_coupon from public.coupons c
   where c.code = p_code and c.agent_id = p_agent_id for update;

  if not found
     or v_coupon.is_active is not true
     or v_coupon.deleted_at is not null
     or (v_coupon.starts_at   is not null and v_coupon.starts_at  > now())
     or (v_coupon.expires_at  is not null and v_coupon.expires_at <= now())
     or (v_coupon.min_order_amount is not null and p_order_subtotal < v_coupon.min_order_amount)
     or (v_coupon.max_uses is not null and coalesce(v_coupon.uses_count,0) >= v_coupon.max_uses)
  then
    raise exception 'Coupon invalid, expired, or limit reached' using errcode = 'check_violation';
  end if;

  if v_coupon.new_customers_only and p_user_id is not null then
    if exists (select 1 from public.orders o where o.buyer_id = p_user_id and o.status <> 'cancelled') then
      raise exception 'Coupon invalid, expired, or limit reached' using errcode = 'check_violation';
    end if;
  end if;

  if v_coupon.max_uses_per_user is not null and p_user_id is not null then
    select count(*) into v_peruser from public.coupon_redemptions r
     where r.coupon_id = v_coupon.id and r.user_id = p_user_id;
    if v_peruser >= v_coupon.max_uses_per_user then
      raise exception 'Coupon invalid, expired, or limit reached' using errcode = 'check_violation';
    end if;
  end if;

  if v_coupon.discount_type::text = 'percent' then
    v_pct := least(greatest(v_coupon.discount_value, 0), 100);
    v_amount := round(p_order_subtotal * v_pct / 100.0, 2);
  else
    v_amount := greatest(v_coupon.discount_value, 0);
  end if;
  v_amount := least(greatest(v_amount, 0), p_order_subtotal);

  update public.coupons set uses_count = coalesce(uses_count,0) + 1 where id = v_coupon.id;
  insert into public.coupon_redemptions (coupon_id, code, user_id) values (v_coupon.id, p_code, p_user_id);

  return query select v_coupon.id, v_coupon.discount_type::text, v_coupon.discount_value, v_amount;
end;
$function$;
