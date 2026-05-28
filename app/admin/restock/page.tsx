'use client';

import { Fragment, useEffect, useState } from 'react';
import Pagination from '@/components/Pagination';

const PAGE_SIZE = 25;

interface AgentRef {
  full_name: string | null;
  username: string | null;
}

interface OrderItem {
  id: string;
  quantity: number;
  product_name: string;
  unit_retail_price: number | null;
}

interface RestockOrder {
  id: string;
  buyer_id: string;
  status: string;
  subtotal: number;
  shipping_cost: number;
  total: number;
  created_at: string;
  is_wholesale_restock: boolean;
  profiles: AgentRef | AgentRef[] | null;
  order_items: OrderItem[] | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending_customer_payment: 'Pending Payment',
  agent_approval_pending: 'Agent Approval Pending',
  approved_ship: 'Approved Ship',
  approved_pickup: 'Approved Pickup',
  in_fulfillment: 'In Fulfillment',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

function resolveAgent(order: RestockOrder): AgentRef | null {
  const raw = order.profiles;
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
}

export default function AdminRestockPage() {
  const [orders, setOrders] = useState<RestockOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/restock');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Load Restock Orders');
      setOrders(json.data ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed To Load Restock Orders');
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = orders.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{ fontSize: '1.6rem', marginBottom: 'var(--space-2)' }}>Wholesale Restock</h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)' }}>
          Recent Wholesale Restock Orders Submitted By Agents. Click A Row To Reveal Line Items.
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '2px solid var(--teal)',
              borderTopColor: 'transparent',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        </div>
      ) : error ? (
        <div className="disclaimer-warning" style={{ padding: 'var(--space-6)' }}>
          <p style={{ color: 'var(--red)', fontSize: '0.9rem' }}>{error}</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="card-metal" style={{ textAlign: 'center', padding: 'var(--space-12) 0' }}>
          <p style={{ color: 'var(--grey-400)', fontSize: '0.88rem' }}>
            No Wholesale Restock Orders Yet.
          </p>
        </div>
      ) : (
        <div className="card-metal" style={{ padding: 'var(--space-4)' }}>
          <div className="table-responsive">
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Agent</th>
                  <th>Item Count</th>
                  <th>Subtotal</th>
                  <th>Shipping</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((order) => {
                  const agent = resolveAgent(order);
                  const items = order.order_items ?? [];
                  const itemCount = items.reduce(
                    (sum, it) => sum + Number(it.quantity || 0),
                    0
                  );
                  const isOpen = expanded === order.id;
                  return (
                    <Fragment key={order.id}>
                      <tr
                        onClick={() => setExpanded(isOpen ? null : order.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>{new Date(order.created_at).toLocaleDateString()}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>
                            {agent?.full_name || 'Unknown Agent'}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)' }}>
                            {agent?.username ? `@${agent.username}` : ''}
                          </div>
                        </td>
                        <td>{itemCount}</td>
                        <td>${Number(order.subtotal || 0).toFixed(2)}</td>
                        <td>${Number(order.shipping_cost || 0).toFixed(2)}</td>
                        <td style={{ color: 'var(--teal)', fontWeight: 700 }}>
                          ${Number(order.total || 0).toFixed(2)}
                        </td>
                        <td>
                          <span className="badge badge-teal" style={{ fontSize: '0.68rem' }}>
                            {STATUS_LABELS[order.status] || order.status}
                          </span>
                        </td>
                      </tr>
                      {isOpen && items.length > 0 && (
                        <tr>
                          <td
                            colSpan={7}
                            style={{
                              background: 'rgba(0,196,188,0.04)',
                              padding: 'var(--space-4)',
                              borderTop: '1px solid rgba(0,196,188,0.12)',
                            }}
                          >
                            <div
                              style={{
                                fontSize: '0.75rem',
                                color: 'var(--grey-400)',
                                marginBottom: 'var(--space-2)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                              }}
                            >
                              Line Items
                            </div>
                            <table
                              style={{
                                width: '100%',
                                fontSize: '0.82rem',
                                color: 'var(--silver)',
                              }}
                            >
                              <thead>
                                <tr style={{ color: 'var(--grey-400)' }}>
                                  <th style={{ textAlign: 'left', padding: '6px 8px' }}>
                                    Product
                                  </th>
                                  <th style={{ textAlign: 'right', padding: '6px 8px' }}>
                                    Quantity
                                  </th>
                                  <th style={{ textAlign: 'right', padding: '6px 8px' }}>
                                    Unit Price
                                  </th>
                                  <th style={{ textAlign: 'right', padding: '6px 8px' }}>
                                    Line Total
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((item) => {
                                  const unit = Number(item.unit_retail_price || 0);
                                  const qty = Number(item.quantity || 0);
                                  return (
                                    <tr key={item.id}>
                                      <td style={{ padding: '6px 8px' }}>{item.product_name}</td>
                                      <td style={{ textAlign: 'right', padding: '6px 8px' }}>
                                        {qty}
                                      </td>
                                      <td style={{ textAlign: 'right', padding: '6px 8px' }}>
                                        ${unit.toFixed(2)}
                                      </td>
                                      <td
                                        style={{
                                          textAlign: 'right',
                                          padding: '6px 8px',
                                          color: 'var(--teal)',
                                        }}
                                      >
                                        ${(unit * qty).toFixed(2)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
