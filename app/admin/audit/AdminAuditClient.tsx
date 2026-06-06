"use client";

import { useState } from "react";

interface AuditRow {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface Props {
  initialRows: AuditRow[];
  initialFilters: { q: string; action: string };
  availableActions: string[];
  limit: number;
}

export default function AdminAuditClient({
  initialRows,
  initialFilters,
  availableActions,
  limit,
}: Props) {
  const [rows, setRows] = useState<AuditRow[]>(initialRows);
  const [q, setQ] = useState(initialFilters.q);
  const [action, setAction] = useState(initialFilters.action);
  const [busy, setBusy] = useState(false);
  const [hasMore, setHasMore] = useState(initialRows.length >= limit);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load(opts: { reset?: boolean } = {}) {
    setBusy(true);
    setLoadError(null);
    try {
      const sp = new URLSearchParams();
      if (q) sp.set("q", q);
      if (action) sp.set("action", action);
      if (!opts.reset && rows.length > 0)
        sp.set("cursor", rows[rows.length - 1].created_at);
      const res = await fetch(`/api/admin/audit?${sp.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setLoadError("Could Not Load Audit Entries. Please Try Again.");
        return;
      }
      const json = await res.json();
      const next: AuditRow[] = json?.data ?? [];
      setRows(opts.reset ? next : [...rows, ...next]);
      setHasMore(next.length >= limit);
    } catch {
      setLoadError("Could Not Load Audit Entries. Please Try Again.");
    } finally {
      setBusy(false);
    }
  }

  function applyFilters() {
    load({ reset: true });
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: "var(--space-3)",
          flexWrap: "wrap",
          marginBottom: "var(--space-4)",
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search Summary…"
          onKeyDown={(e) => {
            if (e.key === "Enter") applyFilters();
          }}
          style={{
            background: "var(--surface-2)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "var(--white)",
            padding: "0.55rem 0.75rem",
            borderRadius: "var(--radius-md)",
            fontSize: "0.9rem",
            minWidth: 220,
          }}
        />
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          style={{
            background: "var(--surface-2)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "var(--white)",
            padding: "0.55rem 0.75rem",
            borderRadius: "var(--radius-md)",
            fontSize: "0.9rem",
          }}
        >
          <option value="">All Actions</option>
          {availableActions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <button
          className="btn-neon-cyan"
          style={{ padding: "6px 12px", fontSize: "0.75rem" }}
          disabled={busy}
          onClick={applyFilters}
        >
          {busy ? "Loading…" : "Filter"}
        </button>
      </div>

      {loadError && (
        <div
          style={{
            background: "rgba(229,62,62,0.12)",
            border: "1px solid rgba(229,62,62,0.4)",
            color: "var(--danger)",
            padding: "0.6rem 0.85rem",
            borderRadius: "var(--radius-md)",
            marginBottom: "var(--space-4)",
            fontSize: "0.85rem",
          }}
        >
          {loadError}
        </div>
      )}

      <div className="glass-panel hover-lift stagger-fade-in">
        <div
          className=""
          style={{ padding: 0, overflowX: "auto" }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.85rem",
            }}
          >
            <thead>
              <tr style={{ }}>
                <th
                  style={{
                    textAlign: "left",
                    padding: "var(--space-3)",
                    color: "var(--silver)",
                  }}
                >
                  When
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "var(--space-3)",
                    color: "var(--silver)",
                  }}
                >
                  Actor
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "var(--space-3)",
                    color: "var(--silver)",
                  }}
                >
                  Action
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "var(--space-3)",
                    color: "var(--silver)",
                  }}
                >
                  Target
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "var(--space-3)",
                    color: "var(--silver)",
                  }}
                >
                  Summary
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      padding: "var(--space-5)",
                      color: "var(--silver)",
                      textAlign: "center",
                    }}
                  >
                    No Audit Entries Match Your Filters.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className="table-row-hover"
                    style={{ }}
                  >
                    <td
                      suppressHydrationWarning
                      style={{
                        padding: "var(--space-3)",
                        color: "var(--silver)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: "var(--space-3)",
                        color: "var(--white)",
                      }}
                    >
                      {r.actor_email ||
                        (r.actor_id ? r.actor_id.slice(0, 8) : "system")}
                    </td>
                    <td style={{ padding: "var(--space-3)" }}>
                      <span
                        style={{
                          background: "var(--surface-2)",
                          color: "var(--teal)",
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: "0.75rem",
                        }}
                      >
                        {r.action}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "var(--space-3)",
                        color: "var(--silver)",
                      }}
                    >
                      {r.target_type && r.target_id
                        ? `${r.target_type}:${r.target_id.slice(0, 8)}`
                        : "-"}
                    </td>
                    <td
                      style={{
                        padding: "var(--space-3)",
                        color: "var(--silver)",
                      }}
                    >
                      {r.summary || "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {hasMore && (
        <div style={{ marginTop: "var(--space-4)", textAlign: "center" }}>
          <button
            className="btn-silver"
            style={{ padding: "6px 12px", fontSize: "0.75rem" }}
            disabled={busy}
            onClick={() => load()}
          >
            {busy ? "Loading…" : "Load More"}
          </button>
        </div>
      )}
    </div>
  );
}
