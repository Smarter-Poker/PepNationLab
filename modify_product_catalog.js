const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app/admin/products/ProductCatalogClient.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add state for house cost
content = content.replace(
  'const [costSaving, setCostSaving] = useState(false);',
  'const [costSaving, setCostSaving] = useState(false);\n  const [editingHouseCostGroupId, setEditingHouseCostGroupId] = useState<string | null>(null);\n  const [editingHouseCostVariantId, setEditingHouseCostVariantId] = useState<string | null>(null);\n  const [editHouseCostText, setEditHouseCostText] = useState("");\n  const [houseCostSaving, setHouseCostSaving] = useState(false);'
);

// 2. Add handleHouseCostSave function
const handleHouseCostSaveFn = `
  const handleHouseCostSave = async (ids: string[], originalCost?: number) => {
    if (houseCostSaving) return;
    const val = parseFloat(editHouseCostText);
    if (!Number.isFinite(val) || val < 0) {
      toast.error("Invalid Cost");
      return;
    }
    if (originalCost !== undefined && Math.abs(val - originalCost) < 0.001) {
      setEditingHouseCostGroupId(null);
      setEditingHouseCostVariantId(null);
      return;
    }
    setHouseCostSaving(true);
    try {
      const res = await fetch("/api/admin/products/update-house-cost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_ids: ids,
          new_value: val,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to update");
      }
      toast.success("Actual Cost Updated");
      setEditingHouseCostGroupId(null);
      setEditingHouseCostVariantId(null);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Network Error");
    } finally {
      setHouseCostSaving(false);
    }
  };
`;
content = content.replace('const handleCostSave = async', handleHouseCostSaveFn + '\n  const handleCostSave = async');

// 3. Add column header
content = content.replace(
  '"Base Cost",',
  '"Actual Cost",\n                  "Base Cost",'
);

// 4. Render Actual Cost cell for groups
const groupBaseCostCell = `                        {/* Base cost per unit */}
                        <td
                          title="Click to edit Base Cost"`;

const groupActualCostCell = `                        {/* Actual cost per unit */}
                        <td
                          title="Click to edit Actual Cost"
                          style={{
                            padding: "var(--space-3)",
                            fontSize: "0.85rem",
                            fontFamily: "var(--font-brand)",
                            color: "var(--grey-400)",
                            cursor: "pointer",
                            whiteSpace: "nowrap"
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (costSaving || houseCostSaving) return;
                            setEditingHouseCostGroupId(p.id);
                            setEditingHouseCostVariantId(null);
                            setEditHouseCostText(p.houseCost.toFixed(2));
                          }}
                        >
                          {editingHouseCostGroupId === p.id ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={e => e.stopPropagation()}>
                              <span style={{ color: '#F87171' }}>$</span>
                              <input
                                type="text"
                                autoFocus
                                className="form-input"
                                style={{ width: 60, padding: '2px 4px', height: 24, fontSize: '0.85rem', background: 'var(--bg-metal-dark)', border: '1px solid #F87171', color: '#fff' }}
                                value={editHouseCostText}
                                onChange={e => {
                                  let clean = e.target.value.replace(/[^0-9.]/g, '');
                                  const dot = clean.indexOf('.');
                                  if (dot !== -1) {
                                    clean = clean.slice(0, dot + 1) + clean.slice(dot + 1).replace(/\\./g, '');
                                    clean = clean.slice(0, dot + 3);
                                  }
                                  setEditHouseCostText(clean);
                                }}
                                onBlur={() => handleHouseCostSave(p.variantIds, p.houseCost)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleHouseCostSave(p.variantIds, p.houseCost);
                                  if (e.key === 'Escape') setEditingHouseCostGroupId(null);
                                }}
                              />
                            </div>
                          ) : (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: 'rgba(248,113,113,0.05)', borderRadius: 6, border: '1px dashed rgba(248,113,113,0.3)', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.background='rgba(248,113,113,0.1)'} onMouseOut={e => e.currentTarget.style.background='rgba(248,113,113,0.05)'}>
                              <div style={{ color: '#F87171', fontWeight: 600 }}>\${p.houseCost.toFixed(2)}</div>
                              <span style={{ fontSize: '0.65rem', color: '#F87171', textTransform: 'uppercase', fontWeight: 700, marginLeft: 4 }}>Edit</span>
                            </div>
                          )}
                        </td>

`;
content = content.replace(groupBaseCostCell, groupActualCostCell + groupBaseCostCell);

// 5. Remove 'House: $...' from Base Cost rendering (group)
content = content.replace(
  /<div style={{ fontSize: '0.62rem', color: 'rgba\(255,255,255,0.4\)', marginTop: 2, fontFamily: 'var\(--font-brand\)' }}>\s*House: \$\{\(p.houseCost\).toFixed\(2\)\}\s*<\/div>/g,
  ''
);

// 6. Render Actual Cost cell for variants
const variantBaseCostCell = `                              {/* Per-unit base cost */}
                              <td
                                title="Click to edit Base Cost"`;

const variantActualCostCell = `                              {/* Per-unit Actual cost */}
                              <td
                                title="Click to edit Actual Cost"
                                style={{
                                  padding: "var(--space-2) var(--space-3)",
                                  fontSize: "0.82rem",
                                  fontFamily: "var(--font-brand)",
                                  color: "var(--grey-500)",
                                  cursor: "pointer",
                                  whiteSpace: "nowrap"
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (costSaving || houseCostSaving) return;
                                  setEditingHouseCostVariantId(v.id);
                                  setEditingHouseCostGroupId(null);
                                  setEditHouseCostText(vHouse.toFixed(2));
                                }}
                              >
                                {editingHouseCostVariantId === v.id ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={e => e.stopPropagation()}>
                                    <span style={{ color: '#F87171' }}>$</span>
                                    <input
                                      type="text"
                                      autoFocus
                                      className="form-input"
                                      style={{ width: 50, padding: '2px 4px', height: 22, fontSize: '0.80rem', background: 'var(--bg-metal-dark)', border: '1px solid #F87171', color: '#fff' }}
                                      value={editHouseCostText}
                                      onChange={e => {
                                        let clean = e.target.value.replace(/[^0-9.]/g, '');
                                        const dot = clean.indexOf('.');
                                        if (dot !== -1) {
                                          clean = clean.slice(0, dot + 1) + clean.slice(dot + 1).replace(/\\./g, '');
                                          clean = clean.slice(0, dot + 3);
                                        }
                                        setEditHouseCostText(clean);
                                      }}
                                      onBlur={() => handleHouseCostSave([v.id], vHouse)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') handleHouseCostSave([v.id], vHouse);
                                        if (e.key === 'Escape') setEditingHouseCostVariantId(null);
                                      }}
                                    />
                                  </div>
                                ) : (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 6px', background: 'rgba(248,113,113,0.03)', borderRadius: 4, border: '1px dashed rgba(248,113,113,0.2)', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.background='rgba(248,113,113,0.08)'} onMouseOut={e => e.currentTarget.style.background='rgba(248,113,113,0.03)'}>
                                    <div style={{ color: '#F87171', fontWeight: 600 }}>\${vHouse.toFixed(2)}</div>
                                    <span style={{ fontSize: '0.60rem', color: '#F87171', textTransform: 'uppercase', fontWeight: 700, marginLeft: 2 }}>Edit</span>
                                  </div>
                                )}
                              </td>

`;
content = content.replace(variantBaseCostCell, variantActualCostCell + variantBaseCostCell);

// 7. Remove 'House: $...' from Base Cost rendering (variant)
content = content.replace(
  /<div style={{ fontSize: '0.60rem', color: 'rgba\(255,255,255,0.3\)', marginTop: 1, fontFamily: 'var\(--font-brand\)' }}>\s*House: \$\{\(vHouse\).toFixed\(2\)\}\s*<\/div>/g,
  ''
);

fs.writeFileSync(filePath, content);
console.log('Modified ProductCatalogClient.tsx successfully');
