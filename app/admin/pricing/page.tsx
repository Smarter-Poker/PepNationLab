"use client";
import { useState, useEffect } from "react";
import ProductTierOverrides from "@/components/ProductTierOverrides";

interface PricingTier {
  tier_name: "tier_1" | "tier_2" | "tier_3";
  display_name: string;
  multiplier: number;
  description: string;
}

export default function PricingTiersPage() {
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [editingTier, setEditingTier] = useState<PricingTier | null>(null);
  const [editMultiplier, setEditMultiplier] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editError, setEditError] = useState("");
  const [sampleBaseCost, setSampleBaseCost] = useState("10.00");

  useEffect(() => { fetchTiers(); }, []);

  async function fetchTiers() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/pricing-tiers");
      const json = await res.json();
      if (res.ok) { setTiers(json || []); }
      else { setError(json.error || "Failed To Load Pricing Tiers"); }
    } catch (err: any) {
      setError(err.message || "An Error Occurred While Loading Tiers");
    } finally { setLoading(false); }
  }

  function startEdit(tier: PricingTier) {
    setEditingTier(tier);
    setEditMultiplier(String(tier.multiplier));
    setEditDisplayName(tier.display_name);
    setEditDescription(tier.description);
    setEditError("");
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTier) return;
    const numMult = Number(editMultiplier);
    if (isNaN(numMult) || numMult < 1.0 || numMult > 99.99) {
      setEditError("Multiplier Must Be A Number Between 1.0 And 99.99");
      return;
    }
    setSaving(editingTier.tier_name);
    setEditError("");
    try {
      const res = await fetch("/api/admin/pricing-tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier_name: editingTier.tier_name, multiplier: numMult, display_name: editDisplayName, description: editDescription }),
      });
      const json = await res.json();
      if (res.ok) {
        setTiers((prev) => prev.map((t) => t.tier_name === editingTier.tier_name ? { ...t, multiplier: numMult, display_name: editDisplayName, description: editDescription } : t));
        setEditingTier(null);
      } else { setEditError(json.error || "Failed To Update Multiplier"); }
    } catch (err: any) {
      setEditError(err.message || "An Error Occurred While Saving");
    } finally { setSaving(null); }
  }

  return (
    <div style={{ padding: "var(--space-8)" }}>
      <div style={{ marginBottom: "var(--space-8)" }}>
        <h1 className="animated-gradient-text" style={{ fontSize: "1.6rem", marginBottom: "var(--space-2)" }}>Pricing Multiplier Tiers</h1>
        <p style={{ fontSize: "0.85rem", color: "var(--grey-400)" }}>Configure Pricing Multipliers For All 3 Tiers. Changes Apply Instantly To Storefront Products.</p>
      </div>
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-12)" }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid var(--teal)", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
        </div>
      ) : error ? (
        <div className="disclaimer-warning" style={{ padding: "var(--space-6)" }}>
          <p style={{ color: "var(--red)", fontSize: "0.9rem" }}>{error}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          {tiers.map((tier) => (
            <div key={tier.tier_name} className="glass-panel hover-lift">
              <div style={{ padding: "var(--space-6)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-4)" }}>
                  <div>
                    <h3 style={{ fontSize: "1.1rem", color: "var(--teal)" }}>{tier.display_name}</h3>
                    <p style={{ fontSize: "0.82rem", color: "var(--grey-400)", marginTop: "var(--space-1)" }}>{tier.description}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--grey-500)", textTransform: "uppercase" }}>Multiplier</div>
                    <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--silver)", lineHeight: 1 }}>{Number(tier.multiplier).toFixed(2)}x</div>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-3) var(--space-4)", background: "var(--surface-1)", borderRadius: "var(--radius-md)", border: "var(--border-subtle)" }}>
                  <div style={{ fontSize: "0.78rem", color: "var(--grey-400)" }}>
                    Preview: $<span style={{ color: "var(--silver)", fontWeight: 600 }}>{Number(sampleBaseCost).toFixed(2)}</span> base = <span style={{ color: "var(--teal)", fontWeight: 700 }}>${(Number(sampleBaseCost) * tier.multiplier / 10).toFixed(2)}</span> retail
                  </div>
                  <button onClick={() => startEdit(tier)} className="btn-silver" style={{ padding: "var(--space-2) var(--space-4)", fontSize: "0.76rem" }}>Edit Multiplier</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <ProductTierOverrides />
      {editingTier && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 'var(--space-4)' }}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: 440 }}>
            <div style={{ padding: "var(--space-6)" }}>
              <h2 className="metal-text" style={{ fontSize: "1.25rem", color: "#fff", marginBottom: "var(--space-2)" }}>Edit Pricing Tier</h2>
              <p style={{ fontSize: "0.8rem", color: "var(--grey-400)", marginBottom: "var(--space-6)" }}>Modifying Multiplier For {editingTier.display_name}</p>
              {editError && (<div className="disclaimer-warning" style={{ marginBottom: "var(--space-4)", padding: "var(--space-3)" }}><p style={{ color: "var(--red)", fontSize: "0.82rem" }}>{editError}</p></div>)}
              <form onSubmit={handleSaveEdit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-display-name">Pricing Tier Name</label>
                  <input id="edit-display-name" type="text" className="form-input" value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-multiplier">Multiplier Value</label>
                  <input id="edit-multiplier" type="number" step="0.01" min="1.0" max="99.99" className="form-input" value={editMultiplier} onChange={(e) => setEditMultiplier(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-description">Description Text</label>
                  <textarea id="edit-description" className="form-input" rows={3} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} required style={{ resize: "vertical" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
                  <button type="button" className="btn-silver" onClick={() => setEditingTier(null)} disabled={saving !== null}>Cancel</button>
                  <button type="submit" className="btn-neon-cyan" disabled={saving !== null}>{saving ? "Saving..." : "Save Multiplier"}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
