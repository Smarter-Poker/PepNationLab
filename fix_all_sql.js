require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const sql = `
    DO $$
    DECLARE
      rec RECORD;
      v_old_base numeric;
      v_chain_cost numeric;
      v_my_markup numeric;
      v_raw_retail numeric;
      v_target_retail numeric;
      v_current_v_cost numeric;
      v_current_v_floor numeric;
      v_parent_markup numeric;
    BEGIN
      FOR rec IN
        SELECT ap.id, ap.agent_id, ap.product_id, p.base_cost, pr.role, pr.default_agent_markup_pct, pr.parent_agent_id,
               parent_pr.role as parent_role, parent_pr.default_agent_markup_pct as parent_markup, parent_pr.is_super_agent as parent_is_super
        FROM agent_products ap
        JOIN products p ON ap.product_id = p.id
        JOIN profiles pr ON ap.agent_id = pr.id
        LEFT JOIN profiles parent_pr ON pr.parent_agent_id = parent_pr.id
        WHERE p.is_banned = false AND ap.agent_id != 'b8bd12e6-8196-401e-b37b-f742caf1596c'
        ORDER BY
          CASE WHEN pr.role = 'super_agent' OR pr.is_super_agent THEN 1 ELSE 2 END
      LOOP
        v_old_base := p.base_cost / 1.35;
        v_chain_cost := v_old_base;
        
        IF rec.role = 'agent' THEN
           IF rec.parent_role = 'super_agent' OR rec.parent_is_super THEN
              v_parent_markup := COALESCE(rec.parent_markup, 25);
              v_chain_cost := v_old_base * (1 + v_parent_markup / 100.0);
           ELSE
              v_chain_cost := v_old_base * 1.5;
           END IF;
        END IF;
        
        v_my_markup := COALESCE(rec.default_agent_markup_pct, 50);
        v_raw_retail := v_chain_cost * (1 + v_my_markup / 100.0);
        
        v_target_retail := ROUND(v_raw_retail) - 0.03;
        
        v_current_v_cost := public.fn_agent_chain_cost(rec.agent_id, rec.product_id);
        IF v_current_v_cost IS NOT NULL AND v_current_v_cost > 0 THEN
           v_current_v_floor := ROUND(v_current_v_cost * 1.10, 2);
           
           IF v_target_retail < v_current_v_floor THEN
              v_target_retail := CEIL(v_current_v_floor) - 0.03;
              IF v_target_retail < v_current_v_floor THEN
                 v_target_retail := v_target_retail + 1.00;
              END IF;
           END IF;
           
           UPDATE agent_products SET retail_price = v_target_retail WHERE id = rec.id;
        END IF;
      END LOOP;
    END;
    $$;
  `;
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql }); // I can't run DO block directly without a custom RPC or pg
  console.log(error);
}
run();
