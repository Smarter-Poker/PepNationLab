"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { paymentMethodLabel, PAYMENT_METHOD_SLUGS } from "@/lib/payment-method-labels";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 25;

interface AgentOption {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  account_type?: "credit" | "prepaid" | null;
}

interface Statement {
  id: string;
  agent_id: string;
  week_start: string;
  week_end: string;
  total_cogs: number;
  total_shipping: number;
  total_owed: number;
  status: "open" | "pending_payment" | "paid";
  paid_at: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  profiles: { full_name: string | null; email: string } | null;
}

const STATUS_LABELS: Record<string, string> = { open: "Open", pending_payment: "Pending Payment", paid: "Paid" };
const STATUS_COLORS: Record<string, string> = { open: "var(--grey-400)", pending_payment: "#00E5FF", paid: "#68D391" };

export default function AdminStatementsPage() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [genAgentId, setGenAgentId] = useState("");
  const [genWeekStart, setGenWeekStart] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [payingStatement, setPayingStatement] = useState<Statement | null>(null);
  const [payMethod, setPayMethod] = useState("zelle");
  const [payReference, setPayReference] = useState("");
  const [savingPaid, setSavingPaid] = useState(false);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true); setError("");
    try {
      const [stRes, agRes] = await Promise.all([fetch("/api/admin/statements"), fetch("/api/admin/researchers")]);
      const stJson = await stRes.json();
      const agJson = await agRes.json();
      if (stRes.ok) { setStatements(stJson.data || []); setPage(1); } else { setError(stJson.error || "Failed To Load Statements"); }
      if (agRes.ok) {
        const all: AgentOption[] = agJson.data || [];
        setAgents(all.filter((p) => (p.role === "agent" || p.role === "super_agent") && p.account_type === "credit"));
      }
    } catch (err) { setError(err instanceof Error ? err.message : "An Error Occurred While Loading Data"); } finally { setLoading(false); }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault(); setGenError("");
    if (!genAgentId || !genWeekStart) { setGenError("Select An Agent And A Week Start Date."); return; }
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/statements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "generate", agentId: genAgentId, weekStart: genWeekStart }) });
      const json = await res.json();
      if (res.ok) await fetchData(); else setGenError(json.error || "Failed To Generate Statement");
    } catch (err) { setGenError(err instanceof Error ? err.message : "An Error Occurred"); } finally { setGenerating(false); }
  }

  async function handleMarkPaid(e: React.FormEvent) {
    e.preventDefault();
    if (!payingStatement) return;
    setSavingPaid(true);
    try {
      const res = await fetch("/api/admin/statements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mark_paid", statementId: payingStatement.id, paymentMethod: payMethod, paymentReference: payReference }) });
      const json = await res.json();
      if (res.ok) { setPayingStatement(null); setPayReference(""); await fetchData(); } else { toast.error(json.error || "Failed To Mark Statement Paid"); }
    } catch (err) { toast.error(err instanceof Error ? err.message : "An Error Occurred"); } finally { setSavingPaid(false); }
  }

  const handleDownloadCSV = () => {
    if (statements.length === 0) return;
    const headers = ["Agent", "Week Start", "Week End", "Cost of Goods", "Shipping", "Total Owed", "Status"];
    const rows = statements.map((s) => { const agentName = s.profiles?.full_name || s.profiles?.email || "Agent"; return [`"${agentName}"`, s.week_start, s.week_end, Number(s.total_cogs).toFixed(2), Number(s.total_shipping).toFixed(2), Number(s.total_owed).toFixed(2), s.status]; });
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `admin_statements_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const outstanding = statements.filter((s) => s.status !== "paid").reduce((acc, s) => acc + Number(s.total_owed), 0);
  const totalPages = Math.max(1, Math.ceil(statements.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedStatements = statements.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div style={{ padding: "var(--space-8)" }}>
      <div style={{ marginBottom: "var(--space-8)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="animated-gradient-text" style={{ fontSize: "1.6rem", marginBottom: "var(--space-2)" }}>Weekly Statements</h1>
          <p style={{ fontSize: "0.85rem", color: "var(--grey-400)" }}>Generate Agent Billing Statements And Track Settlement. Outstanding Balance: <span style={{ color: outstanding > 0 ? "var(--red)" : "var(--teal)", fontWeight: 700 }}>${outstanding.toFixed(2)}</span></p>
        </div>
        {statements.length > 0 && <button onClick={handleDownloadCSV} className="btn-silver">Download CSV Export</button>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: "var(--space-6)", alignItems: "start" }}>
        <div>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-12)" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid var(--teal)", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
            </div>
          ) : error ? (
            <div className="disclaimer-warning" style={{ padding: "var(--space-6)" }}><p style={{ color: "var(--red)", fontSize: "0.9rem" }}>{error}</p></div>
          ) : statements.length === 0 ? (
            <div className="glass-panel hover-lift"><div className="" style={{ textAlign: "center", padding: "var(--space-12) 0" }}><p style={{ color: "var(--grey-400)", fontSize: "0.88rem" }}>No Statements Generated Yet</p></div></div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              {paginatedStatements.map((s) => {
                const statusColor = STATUS_COLORS[s.status] ?? "var(--grey-400)";
                return (
                  <div key={s.id} className="glass-panel hover-lift">
                    <div className="" style={{ padding: "var(--space-5)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-3)" }}>
                        <div>
                          <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--silver)" }}>{s.profiles?.full_name || (s.profiles?.email ? `@${s.profiles.email.split("@")[0]}` : "Agent")}</div>
                          <div style={{ fontSize: "0.78rem", color: "var(--grey-400)", marginTop: 2 }}>Week Of {s.week_start} To {s.week_end}</div>
                        </div>
                        <span style={{ fontSize: "0.72rem", fontWeight: 700, color: statusColor, background: `${statusColor}15`, border: `1px solid ${statusColor}40`, padding: "4px var(--space-3)", borderRadius: "var(--radius-full)", height: "fit-content" }}>
                          {STATUS_LABELS[s.status] ?? s.status}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "var(--space-6)", marginTop: "var(--space-4)", paddingTop: "var(--space-4)", flexWrap: "wrap" }}>
                        <div><div style={{ fontSize: "0.68rem", color: "var(--grey-500)", textTransform: "uppercase" }}>Cost Of Goods</div><div style={{ fontSize: "0.9rem", color: "var(--silver)" }}>${Number(s.total_cogs).toFixed(2)}</div></div>
                        <div><div style={{ fontSize: "0.68rem", color: "var(--grey-500)", textTransform: "uppercase" }}>Shipping</div><div style={{ fontSize: "0.9rem", color: "var(--silver)" }}>${Number(s.total_shipping).toFixed(2)}</div></div>
                        <div><div style={{ fontSize: "0.68rem", color: "var(--grey-500)", textTransform: "uppercase" }}>Total Owed</div><div style={{ fontSize: "0.9rem", color: "var(--teal)", fontWeight: 700 }}>${Number(s.total_owed).toFixed(2)}</div></div>
                        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
                          {s.status !== "paid" ? (
                            <button onClick={() => { setPayingStatement(s); setPayMethod("zelle"); setPayReference(""); }} className="btn-neon-cyan" style={{ padding: "var(--space-2) var(--space-4)", fontSize: "0.78rem" }}>Mark Paid</button>
                          ) : (
                            <div style={{ fontSize: "0.74rem", color: "var(--grey-400)", textAlign: "right" }}>Paid {s.paid_at ? new Date(s.paid_at).toLocaleDateString() : ""}{s.payment_method ? ` / ${paymentMethodLabel(s.payment_method)}` : ""}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {statements.length > PAGE_SIZE && <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />}
            </div>
          )}
        </div>

        <div className="glass-panel hover-lift">
          <div className="" style={{ padding: "var(--space-6)" }}>
            <h3 style={{ fontSize: "0.95rem", color: "var(--silver)", marginBottom: "var(--space-4)" }}>Generate A Statement</h3>
            {genError && <div className="disclaimer-warning" style={{ marginBottom: "var(--space-4)", padding: "var(--space-3)" }}><p style={{ color: "var(--red)", fontSize: "0.8rem" }}>{genError}</p></div>}
            <form onSubmit={handleGenerate}>
              <div className="form-group"><label className="form-label" htmlFor="gen-agent">Agent</label>
                <select id="gen-agent" className="form-input" value={genAgentId} onChange={(e) => setGenAgentId(e.target.value)}>
                  <option value="">Select An Agent</option>
                  {agents.map((a) => (<option key={a.id} value={a.id}>{a.full_name || `Agent ${a.id.slice(0, 8)}`}</option>))}
                </select>
              </div>
              <div className="form-group"><label className="form-label" htmlFor="gen-week">Week Start Date</label><input id="gen-week" type="date" className="form-input" value={genWeekStart} onChange={(e) => setGenWeekStart(e.target.value)} /></div>
              <button type="submit" className="btn-neon-cyan" disabled={generating} style={{ width: "100%", justifyContent: "center" }}>{generating ? "Generating..." : "Generate Statement"}</button>
            </form>
            <p style={{ fontSize: "0.72rem", color: "var(--grey-500)", lineHeight: 1.5, marginTop: "var(--space-4)" }}>The Statement Covers The Selected Date Through Six Days Later. It Aggregates The Agent&apos;s Non-Cancelled Orders Into Cost Of Goods Plus Shipping. Each Agent-Week Combination Can Only Be Generated Once To Prevent Double-Billing.</p>
          </div>
        </div>
      </div>

      {payingStatement && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 'var(--space-4)' }}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: 420 }}>
            <div className="" style={{ padding: "var(--space-6)" }}>
              <h2 className="metal-text" style={{ fontSize: "1.25rem", color: "#fff", marginBottom: "var(--space-2)" }}>Mark Statement Paid</h2>
              <p style={{ fontSize: "0.8rem", color: "var(--grey-400)", marginBottom: "var(--space-6)" }}>{payingStatement.profiles?.full_name || (payingStatement.profiles?.email ? `@${payingStatement.profiles.email.split("@")[0]}` : "Agent")} / Week Of {payingStatement.week_start} / Total ${Number(payingStatement.total_owed).toFixed(2)}</p>
              <form onSubmit={handleMarkPaid}>
                <div className="form-group"><label className="form-label" htmlFor="pay-method">Payment Method</label>
                  <select id="pay-method" className="form-input" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                    {PAYMENT_METHOD_SLUGS.map((slug) => (<option key={slug} value={slug}>{paymentMethodLabel(slug)}</option>))}
                  </select>
                </div>
                <div className="form-group"><label className="form-label" htmlFor="pay-ref">Payment Reference</label><input id="pay-ref" type="text" className="form-input" placeholder="Transaction Note Or Confirmation Number" value={payReference} onChange={(e) => setPayReference(e.target.value)} /></div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
                  <button type="button" className="btn-silver" onClick={() => setPayingStatement(null)} disabled={savingPaid}>Cancel</button>
                  <button type="submit" className="btn-neon-cyan" disabled={savingPaid}>{savingPaid ? "Saving..." : "Confirm Paid"}</button>
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
