"use client";

import { useState, useMemo, Fragment, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import BulkImportModal from "./BulkImportModal";

export interface RawProduct {
  id: string;
  name: string;
  category: string;
  base_cost: number;
  house_cost: number | null;
  is_active: boolean;
  is_banned: boolean | null;
  created_at: string;
  sku: string | null;
  unit_size: string | null;
  unit_measure: string | null;
  inventory_count: number;
  image_url: string | null;
}

interface GroupedProduct {
  /** First id in the group (used for Edit link) */
  id: string;
  name: string;
  category: string;
  /** Lowest base_cost across variants */
  baseCost: number;
  houseCost: number;
  isActive: boolean;
  /** How many SKU rows share this product name */
  variantCount: number;
  /** All variant ids (for future use) */
  variantIds: string[];
  /** All raw variant rows (for expansion) */
  variants: RawProduct[];
  totalInventory: number;
}

type SortKey = "name-asc" | "category" | "price-asc" | "price-desc";

/* -- helpers -- */
interface GroupedProductInternal extends GroupedProduct {
  /** Representative product id used to look up per-product tier overrides. */
  representativeId: string;
}

function groupByName(products: RawProduct[]): GroupedProductInternal[] {
  const map = new Map<string, GroupedProductInternal>();

  for (const p of products) {
    const key = p.name.trim().toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.variantCount += 1;
      existing.variantIds.push(p.id);
      existing.variants.push(p);
      existing.houseCost = Math.min(existing.houseCost, Number(p.house_cost ?? p.base_cost));
      existing.totalInventory += p.inventory_count || 0;
      // keep the lowest base cost as the representative price
      if (Number(p.base_cost) < existing.baseCost) {
        existing.baseCost = Number(p.base_cost);
        existing.representativeId = p.id;
      }
      // if any variant is active, treat the group as active
      if (p.is_active) existing.isActive = true;
    } else {
      map.set(key, {
        id: p.id,
        name: p.name,
        category: p.category,
        baseCost: Number(p.base_cost),
        houseCost: Number(p.house_cost ?? p.base_cost),
        isActive: p.is_active,
        variantCount: 1,
        variantIds: [p.id],
        variants: [p],
        representativeId: p.id,
        totalInventory: p.inventory_count || 0,
      });
    }
  }

  return Array.from(map.values());
}

function fuzzyMatch(text: string, query: string): boolean {
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  // simple substring / partial match
  if (t.includes(q)) return true;
  // character-order fuzzy: every char of query appears in order in text
  let ti = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const found = t.indexOf(q[qi], ti);
    if (found === -1) return false;
    ti = found + 1;
  }
  return true;
}

/* -- component -- */
export default function ProductCatalogClient({
  products,
  multipliers,
  overrides = {},
}: {
  products: RawProduct[];
  multipliers: Record<string, number>;
  /** Optional per-product tier overrides keyed by `${product_id}:${tier_name}`. */
  overrides?: Record<string, number>;
}) {
  const searchParams = useSearchParams();
  const filterParam = searchParams.get("filter");

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("name-asc");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showOutOfStockOnly, setShowOutOfStockOnly] = useState(filterParam === "out_of_stock");
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkPriceModal, setShowBulkPriceModal] = useState(false);
  const [bulkScope, setBulkScope] = useState<
    "master_base_cost" | "master_bulk_price"
  >("master_base_cost");
  const [bulkAdjustment, setBulkAdjustment] = useState<
    "set" | "percent_delta" | "flat_delta"
  >("percent_delta");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkEffectiveAt, setBulkEffectiveAt] = useState("");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [bundles, setBundles] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/agent/bundles/effective').then(r => r.json()).then(d => {
      if (d.data) setBundles(d.data);
    }).catch(e => console.error("Error fetching bundles", e));
  }, []);

  const grouped = useMemo(() => groupByName(products), [products]);

  // unique categories
  const categories = useMemo(() => {
    const set = new Set(grouped.map((p) => p.category));
    return Array.from(set).sort();
  }, [grouped]);

  // filtered + sorted
  const displayed = useMemo(() => {
    let list = grouped;

    // category filter
    if (categoryFilter !== "all") {
      list = list.filter((p) => p.category === categoryFilter);
    }

    // search
    if (search.trim()) {
      list = list.filter((p) => fuzzyMatch(p.name, search.trim()));
    }

    // out of stock filter
    if (showOutOfStockOnly) {
      list = list.filter((p) => p.totalInventory === 0);
    }

    // sort (always A->Z by default; category and price options still available)
    list = [...list];
    switch (sort) {
      case "name-asc":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "category":
        list.sort(
          (a, b) =>
            a.category.localeCompare(b.category) ||
            a.name.localeCompare(b.name),
        );
        break;
      case "price-asc":
        list.sort((a, b) => a.baseCost - b.baseCost);
        break;
      case "price-desc":
        list.sort((a, b) => b.baseCost - a.baseCost);
        break;
    }

    return list;
  }, [grouped, categoryFilter, search, sort, showOutOfStockOnly]);

  const tierPrice = (productId: string, cost: number, tier: string) => {
    const overrideKey = `${productId}:${tier}`;
    const multiplier = overrides[overrideKey] ?? multipliers[tier] ?? 1;
    // Prices in DB are per-10-vial pack. Show per-unit (/ 10) in the catalog.
    return `$${((cost * multiplier) / 10).toFixed(2)}`;
  };

  const toggleGroup = (name: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleAllVisible = () => {
    const next = new Set(selected);
    const allSelected = displayed.every((p) =>
      p.variantIds.every((v) => next.has(v)),
    );
    displayed.forEach((p) => {
      p.variantIds.forEach((vid) => {
        if (allSelected) next.delete(vid);
        else next.add(vid);
      });
    });
    setSelected(next);
  };

  const toggleRow = (variantIds: string[]) => {
    const next = new Set(selected);
    const allOn = variantIds.every((v) => next.has(v));
    variantIds.forEach((v) => {
      if (allOn) next.delete(v);
      else next.add(v);
    });
    setSelected(next);
  };

  const handleBulkSubmit = async () => {
    if (selected.size === 0) {
      toast.error("No Products Selected");
      return;
    }
    const valueNum = Number(bulkValue);
    if (!Number.isFinite(valueNum)) {
      toast.error("Invalid Value");
      return;
    }
    setBulkSubmitting(true);
    try {
      const res = await fetch("/api/admin/products/bulk-price", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          product_ids: Array.from(selected),
          scope: bulkScope,
          adjustment_type: bulkAdjustment,
          new_value: valueNum,
          effective_at: bulkEffectiveAt
            ? new Date(bulkEffectiveAt).toISOString()
            : null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.error ?? "Failed To Apply Bulk Adjustment");
        setBulkSubmitting(false);
        return;
      }
      const applied = json.applied_count ?? 0;
      const scheduled = json.scheduled_count ?? 0;
      if (applied > 0) {
        toast.success(`Applied ${applied} Price Change(s)`);
      } else {
        toast.success(`Scheduled ${scheduled} Price Change(s)`);
      }
      setShowBulkPriceModal(false);
      setSelected(new Set());
      setBulkValue("");
      setBulkEffectiveAt("");
      if (applied > 0) {
        window.location.reload();
      }
    } catch {
      toast.error("Network Error");
    } finally {
      setBulkSubmitting(false);
    }
  };

  /* -- styles -- */
  const controlBarStyle: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: "var(--space-3)",
    marginBottom: "var(--space-6)",
    alignItems: "center",
  };

  const inputStyle: React.CSSProperties = {
    flex: "1 1 260px",
    minWidth: 200,
  };

  const selectStyle: React.CSSProperties = {
    flex: "0 0 auto",
    minWidth: 160,
    cursor: "pointer",
  };

  const thStyle: React.CSSProperties = {
    padding: "var(--space-4)",
    textAlign: "left",
    fontSize: "0.75rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    background: "var(--surface-2)",
    color: "var(--grey-400)",
  };

  return (
    <>
      {/* Control Bar */}
      <div style={controlBarStyle}>
        <input
          id="product-search"
          type="text"
          className="form-input"
          placeholder="Search Products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={inputStyle}
        />

        <select
          id="product-category-filter"
          className="form-input"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={selectStyle}
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--silver)', userSelect: 'none', marginLeft: 8, marginRight: 8 }}>
          <input
            id="out-of-stock-toggle"
            type="checkbox"
            checked={showOutOfStockOnly}
            onChange={(e) => setShowOutOfStockOnly(e.target.checked)}
            style={{ accentColor: 'var(--teal)', width: 16, height: 16, cursor: 'pointer' }}
          />
          <span>Out Of Stock Only</span>
        </label>

        <button
          type="button"
          onClick={() => setShowBulkModal(true)}
          className="btn-silver"
          style={{ padding: "6px 12px", fontSize: "0.75rem", flex: "0 0 auto" }}
        >
          Bulk Import CSV
        </button>
      </div>

      {/* Results count */}
      <p
        style={{
          fontSize: "0.82rem",
          color: "var(--grey-400)",
          marginBottom: "var(--space-4)",
        }}
      >
        Showing {displayed.length} Of {grouped.length} Unique Products
        {search && ` Matching "${search}"`}
      </p>

      {/* Bulk Action Bar */}
      {selected.size > 0 && (
        <div
          className="glass-header"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            background: "rgba(0,196,188,0.12)",
            border: "1px solid rgba(0,196,188,0.4)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-3) var(--space-4)",
            marginBottom: "var(--space-4)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "var(--space-3)",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              color: "var(--teal)",
              fontWeight: 600,
              fontSize: "0.85rem",
            }}
          >
            {selected.size} Variant(s) Selected
          </span>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <button
              type="button"
              className="btn-neon-cyan"
              style={{ padding: "6px 12px", fontSize: "0.75rem" }}
              onClick={() => setShowBulkPriceModal(true)}
            >
              Bulk Adjust Price
            </button>
            <button
              type="button"
              className="btn-silver"
              style={{ padding: "6px 12px", fontSize: "0.75rem" }}
              onClick={() => setSelected(new Set())}
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="glass-panel hover-lift stagger-fade-in">
        <div
          className=""
          style={{ padding: 0, overflowX: "auto" }}
        >
          <table
            style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}
          >
            <thead>
              <tr style={{ }}>
                <th style={thStyle}>
                  <input
                    type="checkbox"
                    aria-label="Select All Visible Products"
                    checked={
                      displayed.length > 0 &&
                      displayed.every((p) =>
                        p.variantIds.every((v) => selected.has(v)),
                      )
                    }
                    onChange={toggleAllVisible}
                  />
                </th>
                {[
                  "Product Name",
                  "Variants",
                  "Category",
                  "Base Cost",
                  "T1 Price",
                  "T2 Price",
                  "T3 Price",
                  "Stock",
                  "Status",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      ...thStyle,
                      whiteSpace: "nowrap",
                      padding: "var(--space-3) var(--space-3)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.length > 0 ? (
                displayed.map((p, i) => {
                  const isExpanded = expandedGroups.has(p.name);
                  const hasMultiple = p.variantCount > 1;
                  return (
                    <Fragment key={p.id}>
                      {/* Main product row */}
                      <tr
                        className="table-row-hover"
                        style={{
                          borderBottom: isExpanded
                            ? "none"
                            : i < displayed.length - 1
                              ? "1px solid rgba(255,255,255,0.04)"
                              : "none",
                          transition: "background 0.15s",
                          cursor: hasMultiple ? "pointer" : "default",
                          background: isExpanded
                            ? "rgba(0,196,188,0.04)"
                            : "transparent",
                        }}
                        onClick={() => hasMultiple && toggleGroup(p.name)}
                      >
                        <td
                          style={{ padding: "var(--space-3)" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            aria-label={`Select ${p.name}`}
                            checked={p.variantIds.every((v) => selected.has(v))}
                            onChange={() => toggleRow(p.variantIds)}
                          />
                        </td>
                        <td
                          style={{ padding: "var(--space-3) var(--space-3)" }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            {hasMultiple && (
                              <span
                                style={{
                                  color: "var(--teal)",
                                  fontSize: "0.65rem",
                                  transition: "transform 0.2s",
                                  display: "inline-block",
                                  transform: isExpanded
                                    ? "rotate(90deg)"
                                    : "rotate(0)",
                                }}
                              >
                                &rsaquo;
                              </span>
                            )}
                            <span
                              style={{
                                fontSize: "0.88rem",
                                fontWeight: 600,
                                color: "var(--white)",
                              }}
                            >
                              {p.name}
                            </span>
                          </div>
                        </td>

                        <td style={{ padding: "var(--space-3)" }}>
                          <span
                            style={{
                              fontSize: "0.72rem",
                              fontWeight: 600,
                              color: hasMultiple
                                ? "var(--teal)"
                                : "var(--grey-400)",
                              background: hasMultiple
                                ? "rgba(192,184,168,0.1)"
                                : "transparent",
                              border: hasMultiple
                                ? "1px solid rgba(192,184,168,0.25)"
                                : "1px solid rgba(255,255,255,0.06)",
                              padding: "2px 8px",
                              borderRadius: "var(--radius-sm)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {p.variantCount === 1
                              ? "1 Size"
                              : `${p.variantCount} Sizes`}
                          </span>
                        </td>

                        <td style={{ padding: "var(--space-3)" }}>
                          <span
                            className="badge badge-silver"
                            style={{
                              fontSize: "0.62rem",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {p.category}
                          </span>
                        </td>

                        {/* Base cost per unit */}
                        <td
                          style={{
                            padding: "var(--space-3)",
                            fontSize: "0.85rem",
                            fontFamily: "var(--font-brand)",
                            color: "var(--grey-400)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          ${(p.houseCost / 10).toFixed(2)}
                          <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.18)', marginTop: 2, fontFamily: 'var(--font-brand)' }}>
                            2x: ${(p.baseCost * 2 / 10).toFixed(2)}
                          </div>
                        </td>

                        {/* Tier prices per unit */}
                        <td
                          style={{
                            padding: "var(--space-3)",
                            fontSize: "0.85rem",
                            fontFamily: "var(--font-brand)",
                            color: "var(--teal)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {tierPrice(p.representativeId, p.baseCost, "tier_1")}
                        </td>
                        <td
                          style={{
                            padding: "var(--space-3)",
                            fontSize: "0.85rem",
                            fontFamily: "var(--font-brand)",
                            color: "var(--silver)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {tierPrice(p.representativeId, p.baseCost, "tier_2")}
                        </td>
                        <td
                          style={{
                            padding: "var(--space-3)",
                            fontSize: "0.85rem",
                            fontFamily: "var(--font-brand)",
                            color: "var(--grey-400)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {tierPrice(p.representativeId, p.baseCost, "tier_3")}
                        </td>

                        {/* Stock */}
                        <td
                          style={{
                            padding: "var(--space-3)",
                            fontSize: "0.85rem",
                            fontFamily: "var(--font-brand)",
                            color: p.totalInventory === 0 ? "var(--red)" : "var(--teal)",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {p.totalInventory === 0 ? (
                            <span style={{ color: 'var(--red)', background: 'rgba(229,62,62,0.12)', padding: '2px 6px', borderRadius: 4, fontSize: '0.75rem' }}>Out Of Stock</span>
                          ) : (
                            `${p.totalInventory} Units`
                          )}
                        </td>

                        <td style={{ padding: "var(--space-3)" }}>
                          <span
                            className={`badge ${p.isActive ? "badge-teal" : "badge-red"}`}
                            style={{ fontSize: "0.62rem" }}
                          >
                            {p.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>

                        <td
                          style={{ padding: "var(--space-3)" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link
                            href={`/admin/products/${p.id}`}
                            style={{
                              fontSize: "0.78rem",
                              color: "var(--teal)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Edit
                          </Link>
                        </td>
                      </tr>

                      {/* Expanded variant rows */}
                      {isExpanded &&
                        p.variants.map((v, vi) => {
                          const sizeLabel =
                            v.unit_size && v.unit_measure
                              ? `${v.unit_size}${v.unit_measure}`
                              : (v.sku ?? "-");
                          const vCost = Number(v.base_cost);
                          const vHouse = Number(v.house_cost ?? v.base_cost);
                          return (
                            <tr
                              key={v.id}
                              className="table-row-hover"
                              style={{
                                borderBottom:
                                  vi < p.variants.length - 1
                                    ? "1px solid rgba(255,255,255,0.03)"
                                    : i < displayed.length - 1
                                      ? "1px solid rgba(255,255,255,0.04)"
                                      : "none",
                                background: "rgba(0,196,188,0.02)",
                              }}
                            >
                              <td
                                style={{
                                  padding: "var(--space-2) var(--space-3)",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  aria-label={`Select ${v.name} ${sizeLabel}`}
                                  checked={selected.has(v.id)}
                                  onChange={() => {
                                    const next = new Set(selected);
                                    if (next.has(v.id)) next.delete(v.id);
                                    else next.add(v.id);
                                    setSelected(next);
                                  }}
                                />
                              </td>
                              <td
                                style={{
                                  padding:
                                    "var(--space-2) var(--space-3) var(--space-2) var(--space-6)",
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: "0.8rem",
                                    color: "var(--grey-300)",
                                  }}
                                >
                                  <span
                                    style={{
                                      background: "rgba(0,196,188,0.12)",
                                      color: "var(--teal)",
                                      fontSize: "0.7rem",
                                      padding: "1px 7px",
                                      borderRadius: 4,
                                      fontWeight: 700,
                                      marginRight: 6,
                                    }}
                                  >
                                    {sizeLabel}
                                  </span>
                                  {v.name}
                                </span>
                              </td>
                              <td />
                              <td />
                              {/* Per-unit base cost */}
                              <td
                                style={{
                                  padding: "var(--space-2) var(--space-3)",
                                  fontSize: "0.82rem",
                                  fontFamily: "var(--font-brand)",
                                  color: "var(--grey-500)",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                ${(vHouse / 10).toFixed(2)}
                                <div style={{ fontSize: '0.60rem', color: 'rgba(255,255,255,0.15)', marginTop: 1, fontFamily: 'var(--font-brand)' }}>
                                  2x: ${(vCost * 2 / 10).toFixed(2)}
                                </div>
                              </td>
                              {/* Per-unit tier prices */}
                              <td
                                style={{
                                  padding: "var(--space-2) var(--space-3)",
                                  fontSize: "0.82rem",
                                  fontFamily: "var(--font-brand)",
                                  color: "rgba(0,196,188,0.7)",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {tierPrice(v.id, vCost, "tier_1")}
                              </td>
                              <td
                                style={{
                                  padding: "var(--space-2) var(--space-3)",
                                  fontSize: "0.82rem",
                                  fontFamily: "var(--font-brand)",
                                  color: "rgba(192,184,168,0.7)",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {tierPrice(v.id, vCost, "tier_2")}
                              </td>
                              <td
                                style={{
                                  padding: "var(--space-2) var(--space-3)",
                                  fontSize: "0.82rem",
                                  fontFamily: "var(--font-brand)",
                                  color: "rgba(150,150,150,0.7)",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {tierPrice(v.id, vCost, "tier_3")}
                              </td>

                              {/* Variant Stock */}
                              <td
                                style={{
                                  padding: "var(--space-2) var(--space-3)",
                                  fontSize: "0.82rem",
                                  fontFamily: "var(--font-brand)",
                                  color: v.inventory_count === 0 ? "var(--red)" : "var(--silver)",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {v.inventory_count === 0 ? (
                                  <span style={{ color: 'var(--red)', fontSize: '0.75rem' }}>Out Of Stock</span>
                                ) : (
                                  `${v.inventory_count} Left`
                                )}
                              </td>

                              <td
                                style={{
                                  padding: "var(--space-2) var(--space-3)",
                                }}
                              >
                                <span
                                  className={`badge ${v.is_active ? "badge-teal" : "badge-red"}`}
                                  style={{ fontSize: "0.6rem" }}
                                >
                                  {v.is_active ? "Active" : "Inactive"}
                                </span>
                              </td>
                              <td
                                style={{
                                  padding: "var(--space-2) var(--space-3)",
                                }}
                              >
                                <Link
                                  href={`/admin/products/${v.id}`}
                                  style={{
                                    fontSize: "0.76rem",
                                    color: "var(--teal)",
                                  }}
                                >
                                  Edit
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                    </Fragment>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={11}
                    style={{ padding: "var(--space-12)", textAlign: "center" }}
                  >
                    <p
                      style={{
                        color: "var(--grey-400)",
                        marginBottom: "var(--space-4)",
                      }}
                    >
                      {search
                        ? "No Products Match Your Search"
                        : "No Products Added Yet"}
                    </p>
                    {!search && (
                      <Link
                        href="/admin/products/new"
                        className="btn-neon-cyan"
                        style={{ padding: "6px 12px", fontSize: "0.75rem" }}
                      >
                        Add Your First Product
                      </Link>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Bundles Section */}
      {bundles.length > 0 && (
        <div style={{ marginTop: 'var(--space-8)' }}>
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--teal)', margin: 0, fontFamily: 'var(--font-brand)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Bundles</h3>
            <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem', margin: '4px 0 0' }}>
              Active bundle offers created by agents.
            </p>
          </div>
          <div className="table-container">
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>Bundle Name</th>
                  <th>Cost</th>
                  <th>List Price</th>
                  <th>Profit</th>
                  <th style={{ width: 80 }}>Margin</th>
                </tr>
              </thead>
              <tbody>
                {bundles.map(b => {
                  const bCost = b.base_cost_total || 0;
                  const bListRaw = b.custom_price != null ? b.custom_price : ((b.retail_value_total || 0) * (1 - (b.discount_percent || 0) / 100));
                  const bList = Math.round(bListRaw * 100) / 100;
                  const profit = bList - bCost;
                  const margin = bCost > 0 ? (profit / bCost) * 100 : 0;
                  return (
                    <tr key={b.id} className="table-row-hover">
                      <td style={{ padding: 'var(--space-3)' }}>
                        {b.image_url ? (
                          <div style={{ width: 40, height: 40, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                            <img src={b.image_url} alt={b.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ) : (
                          (() => {
                            const firstProd = products.find(p => p.id === b.product_ids[0]);
                            if (firstProd?.image_url) {
                              return (
                                <div style={{ width: 40, height: 40, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                                  <img src={firstProd.image_url} alt={b.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                              );
                            }
                            return (
                              <div style={{ background: 'rgba(0,196,188,0.1)', border: '1px solid rgba(0,196,188,0.3)', color: '#00E5FF', fontSize: '0.6rem', fontWeight: 800, padding: '2px 4px', borderRadius: 4, textAlign: 'center' }}>
                                BUNDLE
                              </div>
                            );
                          })()
                        )}
                      </td>
                      <td style={{ padding: 'var(--space-3)' }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff' }}>{b.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--grey-400)' }}>{b.product_ids.length} Products Included</div>
                      </td>
                      <td style={{ padding: 'var(--space-3)', fontSize: '0.85rem', fontFamily: 'var(--font-brand)', color: 'var(--grey-200)' }}>
                        ${bCost.toFixed(2)}
                      </td>
                      <td style={{ padding: 'var(--space-3)', fontSize: '0.85rem', fontFamily: 'var(--font-brand)', color: 'var(--teal)' }}>
                        ${bList.toFixed(2)}
                        {b.custom_price != null && <span style={{ fontSize: '0.65rem', marginLeft: 6, background: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: 2 }}>Fixed</span>}
                      </td>
                      <td style={{ padding: 'var(--space-3)', fontSize: '0.85rem', fontFamily: 'var(--font-brand)', color: profit >= 0 ? 'var(--teal)' : 'var(--red)' }}>
                        ${profit.toFixed(2)}
                      </td>
                      <td style={{ padding: 'var(--space-3)' }}>
                        {bCost > 0 && bList > 0 && (
                          <span className="badge badge-teal" style={{ fontSize: '0.7rem' }}>
                            +{Math.round(margin)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}



      {showBulkModal && (
        <BulkImportModal onClose={() => setShowBulkModal(false)} />
      )}

      {showBulkPriceModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "var(--space-4)",
          }}
        >
          <div className="glass-panel" style={{ width: "100%", maxWidth: 520 }}>
            <div
              className=""
              style={{ padding: "var(--space-6)" }}
            >
              <h2
                className="metal-text"
                style={{
                  fontSize: "1.25rem",
                  marginTop: 0,
                  color: "#fff",
                  marginBottom: "var(--space-4)",
                }}
              >
                Bulk Adjust Price
              </h2>
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "var(--grey-400)",
                  marginBottom: "var(--space-4)",
                }}
              >
                Applying To {selected.size} Variant(s).
              </p>

              <div style={{ marginBottom: "var(--space-4)" }}>
                <label className="form-label">Scope</label>
                <select
                  className="form-input"
                  value={bulkScope}
                  onChange={(e) =>
                    setBulkScope(
                      e.target.value as
                        | "master_base_cost"
                        | "master_bulk_price",
                    )
                  }
                >
                  <option value="master_base_cost">Master Base Cost</option>
                  <option value="master_bulk_price">Master Bulk Price</option>
                </select>
              </div>

              <div style={{ marginBottom: "var(--space-4)" }}>
                <label className="form-label">Adjustment Type</label>
                <select
                  className="form-input"
                  value={bulkAdjustment}
                  onChange={(e) =>
                    setBulkAdjustment(
                      e.target.value as "set" | "percent_delta" | "flat_delta",
                    )
                  }
                >
                  <option value="set">Set To</option>
                  <option value="percent_delta">Percent Delta</option>
                  <option value="flat_delta">Flat Delta</option>
                </select>
              </div>

              <div style={{ marginBottom: "var(--space-4)" }}>
                <label className="form-label">
                  {bulkAdjustment === "percent_delta"
                    ? "Value (%)"
                    : "Value ($)"}
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  placeholder={
                    bulkAdjustment === "percent_delta"
                      ? "E.g. 10 Or -5"
                      : "E.g. 12.50"
                  }
                />
              </div>

              <div style={{ marginBottom: "var(--space-5)" }}>
                <label className="form-label">
                  Effective At (Optional - Empty = Now)
                </label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={bulkEffectiveAt}
                  onChange={(e) => setBulkEffectiveAt(e.target.value)}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "var(--space-3)",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  className="btn-silver"
                  onClick={() => setShowBulkPriceModal(false)}
                  disabled={bulkSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-neon-cyan"
                  onClick={handleBulkSubmit}
                  disabled={bulkSubmitting || !bulkValue}
                >
                  {bulkSubmitting ? "Submitting..." : "Apply Bulk Adjustment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
