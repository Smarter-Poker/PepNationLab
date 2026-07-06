import { createClient, createAdminClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import ProductCatalogClient from "./ProductCatalogClient";
import type { RawProduct } from "./ProductCatalogClient";

export default async function AdminProductsPage() {
  const supabaseAuth = await createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) redirect("/login");

  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "admin" && profile.role !== "shipping")) {
    return redirect("/dashboard");
  }

  if (profile.role === "shipping") {
    return redirect("/admin/orders");
  }

  const { data: products } = await supabase
    .from("products")
    .select(
      "id, name, category, base_cost, is_active, is_banned, created_at, sku, unit_size, unit_measure, inventory_count",
    )
    .order("created_at", { ascending: false });

  const { data: tiers } = await supabase
    .from("pricing_tiers")
    .select("tier_name, multiplier")
    .order("tier_name");

  const multipliers: Record<string, number> = {};
  tiers?.forEach((t) => {
    multipliers[t.tier_name] = t.multiplier;
  });

  // Per-product overrides - keyed by `${product_id}:${tier_name}`. The client
  // component prefers the override when present and falls back to the global
  // multiplier otherwise.
  const productIds = (products ?? []).map((p) => p.id);
  const overrides: Record<string, number> = {};
  if (productIds.length > 0) {
    const { data: overrideRows } = await supabase
      .from("product_tier_overrides")
      .select("product_id, tier_name, custom_multiplier")
      .in("product_id", productIds);
    overrideRows?.forEach((o) => {
      overrides[`${o.product_id}:${o.tier_name}`] = Number(o.custom_multiplier);
    });
  }

  return (
    <div style={{ padding: "var(--space-8)" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "var(--space-8)",
        }}
      >
        <div>
          <h1 className="animated-gradient-text" style={{ fontSize: "1.6rem", marginBottom: "var(--space-2)" }}>
            Product Catalog
          </h1>
          <p style={{ fontSize: "0.85rem", color: "var(--grey-400)" }}>
            {products?.length ?? 0} SKUs • Manage Research Compound Listings
          </p>
        </div>
        <Link href="/admin/products/new" className="btn-neon-cyan">
          + Add Product
        </Link>
      </div>

      {/* Interactive catalog (client component) */}
      <Suspense fallback={<div style={{ padding: "var(--space-12)", textAlign: "center", color: "var(--teal)", fontWeight: 600 }}>Loading Catalog...</div>}>
        <ProductCatalogClient
          products={(products ?? []) as RawProduct[]}
          multipliers={multipliers}
          overrides={overrides}
        />
      </Suspense>
    </div>
  );
}
