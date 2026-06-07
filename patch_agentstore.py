import re

with open('components/AgentStoreProducts.tsx', 'r') as f:
    content = f.read()

# We want to replace the `isEditing ? (` block all the way to `</div>\n                    </div>\n                  )}`

# The simplest way is to replace the interior of the map function:
# From: `return (\n                <div\n                  key={p.id}\n                  className="glass-panel"`
# To the end of the return statement.

new_row_code = """return (
                <div
                  key={p.id}
                  className="glass-panel"
                  style={{
                    padding: 'var(--space-4) var(--space-5)',
                    margin: 0,
                    borderRadius: 0,
                    borderLeft: 'none', borderRight: 'none',
                    opacity: p.is_visible ? 1 : 0.5,
                    transition: 'opacity 0.2s',
                  }}
                >
                  {isEditing ? (
                    <div className="agentprod-card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                      <img
                        src={p.custom_image_url || p.products.image_url || '/images/peptide_clear.png'}
                        alt={displayName}
                        style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}
                        onError={(e) => { (e.target as any).src = '/images/peptide_clear.png'; }}
                      />
                      <div className="agentprod-info" style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>{displayName}</span>
                          {sizeLabel && <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>{sizeLabel}</span>}
                          <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>{p.products.category}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Your Cost:</span>
                            {p.agent_cost != null && p.agent_cost > 0 ? (
                              <span style={{ fontSize: '0.82rem', color: '#68D391', fontWeight: 700 }}>${(p.agent_cost / (/bac\.?\s*water/i.test(p.products?.name || "") ? 1 : 10)).toFixed(2)} / {/bac\.?\s*water/i.test(p.products?.name || "") ? "10x 10ml Viles" : "Vial"}</span>
                            ) : (
                              <span style={{ fontSize: '0.82rem', color: '#68D391', fontWeight: 700 }}>TBD</span>
                            )}
                          </div>
                          <div style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.2)' }}>→</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ position: 'relative' }}>
                              <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#00E5FF', fontWeight: 700, fontSize: '0.85rem', pointerEvents: 'none' }}>$</span>
                              <input
                                type="number"
                                step="0.01"
                                autoFocus
                                className="form-input"
                                style={{ width: 80, padding: '4px 4px 4px 18px', height: 28, fontSize: '0.85rem', background: 'var(--bg-metal-dark)', border: '1px solid #00E5FF', boxShadow: '0 0 5px rgba(0,229,255,0.3)', color: '#fff' }}
                                value={Number((editForm as any).retail_price) >= 0 ? (Number((editForm as any).retail_price) / (/bac\.?\s*water/i.test(p.products?.name || "") ? 1 : 10)).toFixed(2) : ''}
                                onChange={e => {
                                  const perVial = parseFloat(e.target.value) || 0;
                                  const per10 = perVial * 10;
                                  const newMargin = p.agent_cost && p.agent_cost > 0 ? Math.round((per10 / p.agent_cost - 1) * 100) : (editForm as any).margin_percent ?? 50;
                                  setEditForm({ ...editForm, retail_price: per10, margin_percent: newMargin } as any);
                                }}
                                onKeyDown={e => { if (e.key === 'Enter') handleSave(e as any); }}
                              />
                            </div>
                            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>/ {/bac\.?\s*water/i.test(p.products?.name || "") ? "10x 10ml Viles" : "Vial"}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0,229,255,0.1)', padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(0,229,255,0.3)' }}>
                              <span style={{ fontSize: '0.65rem', color: '#00E5FF', fontWeight: 700 }}>+</span>
                              <input
                                type="number"
                                className="form-input"
                                style={{ width: 40, padding: 0, height: 20, fontSize: '0.75rem', background: 'transparent', border: 'none', color: '#00E5FF', fontWeight: 700, textAlign: 'center' }}
                                value={(editForm as any).margin_percent ?? 50}
                                onChange={e => {
                                  const pct = Number(e.target.value);
                                  const newPrice = p.agent_cost != null && p.agent_cost > 0 ? p.agent_cost * (1 + pct / 100) : (editForm as any).retail_price;
                                  setEditForm({ ...editForm, margin_percent: pct, retail_price: newPrice } as any);
                                }}
                                onKeyDown={e => { if (e.key === 'Enter') handleSave(e as any); }}
                              />
                              <span style={{ fontSize: '0.65rem', color: '#00E5FF', fontWeight: 700 }}>%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="agentprod-actions" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <button onClick={handleSave} disabled={saving} className="btn-neon-cyan" style={{ padding: '4px 12px', fontSize: '0.75rem', height: 32 }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button onClick={() => setEditingId(null)} className="btn-silver" style={{ padding: '4px 12px', fontSize: '0.75rem', height: 32 }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="agentprod-card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                      <img
                        src={p.custom_image_url || p.products.image_url || '/images/peptide_clear.png'}
                        alt={displayName}
                        style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}
                        onError={(e) => { (e.target as any).src = '/images/peptide_clear.png'; }}
                      />
                      <div className="agentprod-info" style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>{displayName}</span>
                          {sizeLabel && <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>{sizeLabel}</span>}
                          <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>{p.products.category}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Your Cost:</span>
                            {p.agent_cost != null && p.agent_cost > 0 ? (
                              <span style={{ fontSize: '0.82rem', color: '#68D391', fontWeight: 700 }}>${(p.agent_cost / (/bac\.?\s*water/i.test(p.products?.name || "") ? 1 : 10)).toFixed(2)} / {/bac\.?\s*water/i.test(p.products?.name || "") ? "10x 10ml Viles" : "Vial"}</span>
                            ) : (
                              <span style={{ fontSize: '0.82rem', color: '#68D391', fontWeight: 700 }}>TBD</span>
                            )}
                          </div>
                          <div style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.2)' }}>→</div>
                          <div style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer' }} onClick={() => handleEdit(p)} title="Click to edit price">
                            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Listed:</span>
                            <span style={{ fontSize: '0.9rem', color: '#00E5FF', fontWeight: 700, borderBottom: '1px dashed rgba(0,229,255,0.5)', paddingBottom: 1 }}>${(Number(p.retail_price) / (/bac\.?\s*water/i.test(p.products?.name || "") ? 1 : 10)).toFixed(2)} / {/bac\.?\s*water/i.test(p.products?.name || "") ? "10x 10ml Viles" : "Vial"}</span>
                          </div>
                          {p.is_on_sale && p.sale_price && (
                            <span style={{ fontSize: '0.7rem', color: '#FC8181', fontWeight: 700, background: 'rgba(229,62,62,0.10)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(229,62,62,0.2)' }}>
                              On Sale ${(Number(p.sale_price) / (/bac\.?\s*water/i.test(p.products?.name || "") ? 1 : 10)).toFixed(2)} / {/bac\.?\s*water/i.test(p.products?.name || "") ? "10x 10ml Viles" : "Vial"}
                            </span>
                          )}
                          {p.agent_cost != null && p.agent_cost > 0 && p.retail_price > 0 && (
                            <span onClick={() => handleEdit(p)} style={{ cursor: 'pointer', fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(0,229,255,0.1)', color: (p.retail_price / p.agent_cost - 1) >= 0.15 ? '#00E5FF' : '#00E5FF', border: '1px solid rgba(0,229,255,0.2)' }} title="Click to edit margin">
                              +{Math.round((p.retail_price / p.agent_cost - 1) * 100)}%
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="agentprod-actions" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <button
                          onClick={() => toggleVisibility(p)}
                          style={{ width: 70, height: 32, minWidth: 70, minHeight: 32, borderRadius: 16, border: '1px solid rgba(0,0,0,0.45)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', background: p.is_visible ? '#00E5FF' : 'rgba(255,255,255,0.12)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.45)' }}
                          title={p.is_visible ? 'On - Tap To Hide' : 'Off - Tap To Show'}
                          aria-label={p.is_visible ? 'Visibility On' : 'Visibility Off'}
                          aria-checked={p.is_visible}
                          role="switch"
                        >
                          <span style={{ position: 'absolute', top: 5, left: p.is_visible ? 43 : 5, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.5)' }} />
                          <span style={{ position: 'absolute', top: 9, left: p.is_visible ? 12 : 34, fontSize: '0.62rem', fontWeight: 800, color: p.is_visible ? '#063A47' : 'rgba(255,255,255,0.6)', letterSpacing: '0.04em', pointerEvents: 'none' }}>
                            {p.is_visible ? 'ON' : 'OFF'}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );"""

# The chunk we want to replace starts with:
pattern = re.compile(r'return \(\s*<div\s*key=\{p\.id\}\s*className="glass-panel".*?</div>\s*\);\s*\}\)', re.DOTALL)

def replacer(match):
    return new_row_code + "\n            })"

content = pattern.sub(replacer, content)

with open('components/AgentStoreProducts.tsx', 'w') as f:
    f.write(content)
