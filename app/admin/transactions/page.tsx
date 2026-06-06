"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Pagination from "@/components/Pagination";
import { exportCSV, downloadCSV } from "@/lib/export";

const PAGE_SIZE = 25;

interface Transaction {
  id: string;
  agent_id: string;
  type: string;
  // Postgres numeric serializes as string over PostgREST - keep loose typing
  // and coerce with Number(...) at render time.
  amount: number | string;
  balance_before: number | string;
  balance_after: number | string;
  description: string;
  reference_id: string | null;
  reference_type: string | null;
  created_at: string;
  profiles: {
    full_name: string | null;
    email: string;
  };
}

// Allowed values of `balance_transactions.type` (DB CHECK constraint):
// 'credit' | 'debit' | 'order_charge' | 'statement_payment'
// | 'initial_deposit' | 'adjustment'
const TYPE_META: Record<string, { label: string; badge: string }> = {
  credit: { label: "Credit", badge: "badge-teal" },
  debit: { label: "Debit", badge: "badge-red" },
  order_charge: { label: "Order Charge", badge: "badge-red" },
  statement_payment: { label: "Statement Payment", badge: "badge-teal" },
  initial_deposit: { label: "Initial Deposit", badge: "badge-teal" },
  adjustment: { label: "Adjustment", badge: "badge-silver" },
};

function AdminTransactionsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string>(
    searchParams.get("type") ?? "all",
  );
  const [agentFilter, setAgentFilter] = useState<string>(
    searchParams.get("agent") ?? "all",
  );
  const [dateFrom, setDateFrom] = useState<string>(
    searchParams.get("from") ?? "",
  );
  const [dateTo, setDateTo] = useState<string>(searchParams.get("to") ?? "");

  // Persist filter state to URL.
  useEffect(() => {
    const params = new URLSearchParams();
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (agentFilter !== "all") params.set("agent", agentFilter);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    const qs = params.toString();
    router.replace(qs ? `/admin/transactions?${qs}` : "/admin/transactions", {
      scroll: false,
    });
  }, [typeFilter, agentFilter, dateFrom, dateTo, router]);

  // Build agent dropdown from observed transactions.
  const agentOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const tx of transactions) {
      if (!tx.agent_id || map.has(tx.agent_id)) continue;
      const label =
        tx.profiles?.full_name ||
        (tx.profiles?.email
          ? `@${tx.profiles.email.split("@")[0]}`
          : tx.agent_id.slice(0, 8));
      map.set(tx.agent_id, label);
    }
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [transactions]);

  // Filter the in-memory ledger.
  const filteredTransactions = useMemo(() => {
    const fromMs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toMs = dateTo ? new Date(dateTo).getTime() + 86399999 : null;
    return transactions.filter((tx) => {
      if (typeFilter !== "all" && tx.type !== typeFilter) return false;
      if (agentFilter !== "all" && tx.agent_id !== agentFilter) return false;
      const createdMs = new Date(tx.created_at).getTime();
      if (fromMs !== null && createdMs < fromMs) return false;
      if (toMs !== null && createdMs > toMs) return false;
      return true;
    });
  }, [transactions, typeFilter, agentFilter, dateFrom, dateTo]);

  function resetTxFilters() {
    setTypeFilter("all");
    setAgentFilter("all");
    setDateFrom("");
    setDateTo("");
  }

  useEffect(() => {
    fetchTransactions();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [typeFilter, agentFilter, dateFrom, dateTo]);

  const fetchTransactions = async () => {
    try {
      const res = await fetch("/api/admin/transactions?limit=250");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load ledger");
      setTransactions(json.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getUsername = (email: string, fullName: string | null) => {
    if (fullName) return fullName;
    if (!email) return "Unknown";
    return `@${email.split("@")[0]}`;
  };

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTransactions.length / PAGE_SIZE),
  );
  const safePage = Math.min(page, totalPages);
  const paginatedTransactions = filteredTransactions.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  return (
    <div style={{ padding: "var(--space-8)" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "var(--space-8)",
        }}
      >
        <div>
          <h1
            className="animated-gradient-text"
            style={{
              fontSize: "2rem",
              color: "var(--white)",
              marginBottom: "var(--space-2)",
            }}
          >
            Global Master Ledger
          </h1>
          <p
            style={{ color: "var(--grey-400)", fontSize: "0.95rem", margin: 0 }}
          >
            Immutable Record Of All System Financial Transactions & Balance
            Modifications.
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          <button
            type="button"
            className="btn-silver"
            style={{ padding: "6px 12px", fontSize: "0.75rem" }}
            disabled={filteredTransactions.length === 0}
            onClick={() => {
              const rows = filteredTransactions.map((tx) => {
                const meta = TYPE_META[tx.type];
                return {
                  created_at: new Date(tx.created_at).toISOString(),
                  agent:
                    tx.profiles?.full_name ||
                    (tx.profiles?.email
                      ? `@${tx.profiles.email.split("@")[0]}`
                      : "Unknown"),
                  type: meta?.label || tx.type.replace(/_/g, " "),
                  description: tx.description || "",
                  amount: Number(tx.amount).toFixed(2),
                  balance_after: Number(tx.balance_after).toFixed(2),
                };
              });
              const csv = exportCSV(rows, [
                { key: "created_at", label: "Date" },
                { key: "agent", label: "Agent" },
                { key: "type", label: "Type" },
                { key: "description", label: "Description" },
                { key: "amount", label: "Amount" },
                { key: "balance_after", label: "Balance After" },
              ]);
              downloadCSV(
                `admin_transactions_${new Date().toISOString().slice(0, 10)}.csv`,
                csv,
              );
            }}
          >
            Export CSV
          </button>
          <button
            onClick={fetchTransactions}
            className="btn-silver"
            style={{ padding: "6px 12px", fontSize: "0.75rem" }}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh Ledger"}
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "var(--space-4)",
            background: "var(--red-bg)",
            borderLeft: "3px solid var(--red)",
            borderRadius: "0 var(--radius-md) var(--radius-md) 0",
            marginBottom: "var(--space-6)",
            color: "var(--red)",
          }}
        >
          {error}
        </div>
      )}

      {/* Filters */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-3)",
          marginBottom: "var(--space-6)",
          padding: "var(--space-4)",
          background: "var(--surface-1)",
          border: "var(--border-subtle)",
          borderRadius: "var(--radius-md)",
          alignItems: "flex-end",
        }}
      >
        <div style={{ flex: "1 1 160px", minWidth: 140 }}>
          <label className="form-label" style={{ fontSize: "0.7rem" }}>
            Type
          </label>
          <select
            className="form-input"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="credit">Credit</option>
            <option value="debit">Debit</option>
            <option value="order_charge">Order Charge</option>
            <option value="statement_payment">Statement Payment</option>
            <option value="initial_deposit">Initial Deposit</option>
            <option value="adjustment">Adjustment</option>
          </select>
        </div>
        <div style={{ flex: "1 1 200px", minWidth: 160 }}>
          <label className="form-label" style={{ fontSize: "0.7rem" }}>
            Agent
          </label>
          <select
            className="form-input"
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
          >
            <option value="all">All Agents</option>
            {agentOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: "1 1 140px", minWidth: 120 }}>
          <label className="form-label" style={{ fontSize: "0.7rem" }}>
            From Date
          </label>
          <input
            type="date"
            className="form-input"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div style={{ flex: "1 1 140px", minWidth: 120 }}>
          <label className="form-label" style={{ fontSize: "0.7rem" }}>
            To Date
          </label>
          <input
            type="date"
            className="form-input"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={resetTxFilters}
          className="btn-silver"
          style={{ padding: "6px 12px", fontSize: "0.78rem" }}
        >
          Reset
        </button>
      </div>

      <div className="glass-panel hover-lift stagger-fade-in">
        <div
          className=""
          style={{ padding: 0, overflowX: "auto" }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
            }}
          >
            <thead>
              <tr
                style={{
                  background: "rgba(255,255,255,0.02)",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <th
                  style={{
                    padding: "var(--space-4)",
                    color: "var(--grey-400)",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Date
                </th>
                <th
                  style={{
                    padding: "var(--space-4)",
                    color: "var(--grey-400)",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Agent Profile
                </th>
                <th
                  style={{
                    padding: "var(--space-4)",
                    color: "var(--grey-400)",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Event Type
                </th>
                <th
                  style={{
                    padding: "var(--space-4)",
                    color: "var(--grey-400)",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Description
                </th>
                <th
                  style={{
                    padding: "var(--space-4)",
                    color: "var(--grey-400)",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    textAlign: "right",
                  }}
                >
                  Amount
                </th>
                <th
                  style={{
                    padding: "var(--space-4)",
                    color: "var(--grey-400)",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    textAlign: "right",
                  }}
                >
                  Balance Post
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && transactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: "var(--space-8)",
                      textAlign: "center",
                      color: "var(--grey-400)",
                    }}
                  >
                    Syncing Ledger Data...
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: "var(--space-8)",
                      textAlign: "center",
                      color: "var(--grey-400)",
                    }}
                  >
                    No Transactions Match The Current Filters.
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((tx) => {
                  const meta = TYPE_META[tx.type] ?? {
                    label: tx.type.replace(/_/g, " "),
                    badge: "badge-silver",
                  };
                  const rawAmount = Number(tx.amount);
                  const balanceAfter = Number(tx.balance_after);
                  const safeAmount = Number.isFinite(rawAmount) ? rawAmount : 0;
                  const safeBalance = Number.isFinite(balanceAfter)
                    ? balanceAfter
                    : 0;
                  const isPositive = safeAmount >= 0;
                  const sign = isPositive ? "+" : "-";
                  const amountColor = isPositive ? "var(--teal)" : "var(--red)";
                  return (
                    <tr
                      key={tx.id}
                      className="table-row-hover"
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                      }}
                    >
                      <td
                        style={{
                          padding: "var(--space-4)",
                          color: "var(--silver-light)",
                          fontSize: "0.85rem",
                        }}
                      >
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                      <td
                        style={{
                          padding: "var(--space-4)",
                          fontSize: "0.9rem",
                          color: "var(--white)",
                        }}
                      >
                        {getUsername(
                          tx.profiles?.email,
                          tx.profiles?.full_name,
                        )}
                      </td>
                      <td style={{ padding: "var(--space-4)" }}>
                        <span
                          className={`badge ${meta.badge}`}
                          style={{ fontSize: "0.7rem" }}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "var(--space-4)",
                          color: "var(--silver)",
                          fontSize: "0.85rem",
                        }}
                      >
                        {tx.description}
                      </td>
                      <td
                        style={{
                          padding: "var(--space-4)",
                          color: amountColor,
                          fontSize: "0.95rem",
                          fontWeight: 600,
                          textAlign: "right",
                          fontFamily: "var(--font-brand)",
                        }}
                      >
                        {sign}${Math.abs(safeAmount).toFixed(2)}
                      </td>
                      <td
                        style={{
                          padding: "var(--space-4)",
                          color: "var(--white)",
                          fontSize: "0.9rem",
                          fontWeight: 500,
                          textAlign: "right",
                        }}
                      >
                        ${safeBalance.toFixed(2)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination
        page={safePage}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}

export default function AdminTransactionsPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "var(--space-8)" }}>
          <p style={{ fontSize: "0.85rem", color: "var(--grey-400)" }}>
            Loading Ledger...
          </p>
        </div>
      }
    >
      <AdminTransactionsPageInner />
    </Suspense>
  );
}
