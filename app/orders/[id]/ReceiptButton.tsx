'use client';

import { printableHTML, downloadPrintablePDF } from '@/lib/export';

interface OrderItemReceipt {
  product_name: string;
  quantity: number;
  unit_retail_price: number;
}

interface ReceiptProps {
  orderId: string;
  createdAt: string;
  buyerName: string;
  buyerEmail: string;
  sellerName: string;
  /** Agent's uploaded logo URL — shown in receipt/invoice header instead of text-only branding */
  sellerLogoUrl?: string | null;
  paymentMethodLabel: string;
  paymentHandle: string | null;
  trackingNumber: string | null;
  shippingAddress: {
    fullName?: string;
    street?: string;
    suite?: string;
    city?: string;
    state?: string;
    zip?: string;
  } | null;
  items: OrderItemReceipt[];
  subtotal: number;
  discount: number;
  couponCode: string | null;
  shipping: number;
  total: number;
}

function fmt(value: number): string {
  return `$${(Number(value) || 0).toFixed(2)}`;
}

function esc(value: string | null | undefined): string {
  if (value == null) return '';
  return String(value).replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return ch;
    }
  });
}

export default function ReceiptButton(props: ReceiptProps) {
  function onClick() {
    const orderShort = props.orderId.slice(0, 8).toUpperCase();
    const dateStr = new Date(props.createdAt).toLocaleString();

    const shippingLines: string[] = [];
    if (props.shippingAddress?.fullName) shippingLines.push(esc(props.shippingAddress.fullName));
    if (props.shippingAddress?.street) shippingLines.push(esc(props.shippingAddress.street));
    if (props.shippingAddress?.suite) shippingLines.push(esc(props.shippingAddress.suite));
    if (props.shippingAddress?.city) {
      shippingLines.push(
        `${esc(props.shippingAddress.city)}, ${esc(props.shippingAddress.state)} ${esc(props.shippingAddress.zip)}`
      );
    }

    const brandBlock = props.sellerLogoUrl
      ? `<img src="${esc(props.sellerLogoUrl)}" alt="${esc(props.sellerName)}" style="max-height:60px; max-width:180px; object-fit:contain; display:block;" />`
      : `<div><h1>${esc(props.sellerName)}</h1><h2>Order Receipt</h2></div>`;

    const headerHtml = `
      <div class="brand">
        <div>${brandBlock}</div>
        <div class="meta">
          <div><strong>Order #${esc(orderShort)}</strong></div>
          <div>${esc(dateStr)}</div>
        </div>
      </div>
      <div style="display:flex; gap:32px; margin-bottom:16px;">
        <div style="flex:1;">
          <div style="font-size:10px; color:#A8B4C0; text-transform:uppercase; letter-spacing:0.05em;">Buyer</div>
          <div style="margin-top:4px; font-weight:600;">${esc(props.buyerName)}</div>
          <div style="color:#4a5568;">${esc(props.buyerEmail)}</div>
        </div>
        ${shippingLines.length ? `
        <div style="flex:1;">
          <div style="font-size:10px; color:#A8B4C0; text-transform:uppercase; letter-spacing:0.05em;">Shipping Address</div>
          <div style="margin-top:4px;">${shippingLines.join('<br/>')}</div>
        </div>` : ''}
        <div style="flex:1;">
          <div style="font-size:10px; color:#A8B4C0; text-transform:uppercase; letter-spacing:0.05em;">Seller</div>
          <div style="margin-top:4px; font-weight:600;">${esc(props.sellerName)}</div>
        </div>
      </div>
    `;

    const rowsHtml = (() => {
      // Group items by bundle
      const grouped: { isBundle: boolean; name: string; items: typeof props.items }[] = [];
      const processed = new Set<string>();

      props.items.forEach((it, idx) => {
        if (processed.has(idx.toString())) return;
        const match = it.product_name.match(/^(.*?)\s+\[Part of:\s+(.*?)\]$/);
        if (match) {
          const bundleName = match[2];
          const bundleItems = props.items.filter(i => {
            const m = i.product_name.match(/^(.*?)\s+\[Part of:\s+(.*?)\]$/);
            return m && m[2] === bundleName;
          });
          if (!grouped.find(g => g.isBundle && g.name === bundleName)) {
            grouped.push({ isBundle: true, name: bundleName, items: bundleItems });
          }
          bundleItems.forEach((_, iIdx) => {
            const originalIdx = props.items.findIndex(i => i === bundleItems[iIdx]);
            processed.add(originalIdx.toString());
          });
        } else {
          grouped.push({ isBundle: false, name: it.product_name, items: [it] });
          processed.add(idx.toString());
        }
      });

      let html = `
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th class="num">Qty</th>
              <th class="num">Unit</th>
              <th class="num">Line Total</th>
            </tr>
          </thead>
          <tbody>
      `;

      grouped.forEach(g => {
        if (g.isBundle) {
          const bundleQty = g.items[0].quantity; // Assuming bundles are bought in sets
          const bundleTotal = g.items.reduce((acc, it) => acc + (it.unit_retail_price * it.quantity), 0);
          html += `
            <tr style="background-color: #f8fafc;">
              <td colspan="4" style="font-weight: bold; color: #0d9488; padding-top: 12px;">[Stack] ${esc(g.name)}</td>
            </tr>
          `;
          g.items.forEach(it => {
            const m = it.product_name.match(/^(.*?)\s+\[Part of:\s+(.*?)\]$/);
            const cleanName = m ? m[1] : it.product_name;
            html += `
              <tr style="background-color: #f8fafc;">
                <td style="padding-left: 20px;">↳ ${esc(cleanName)}</td>
                <td class="num">${Number(it.quantity) || 0}</td>
                <td class="num">${fmt(it.unit_retail_price)}</td>
                <td class="num">${fmt((Number(it.unit_retail_price) || 0) * (Number(it.quantity) || 0))}</td>
              </tr>
            `;
          });
        } else {
          g.items.forEach(it => {
            html += `
              <tr>
                <td>${esc(it.product_name)}</td>
                <td class="num">${Number(it.quantity) || 0}</td>
                <td class="num">${fmt(it.unit_retail_price)}</td>
                <td class="num">${fmt((Number(it.unit_retail_price) || 0) * (Number(it.quantity) || 0))}</td>
              </tr>
            `;
          });
        }
      });

      html += `
          </tbody>
        </table>
      `;
      return html;
    })();

    const couponLine = props.discount > 0
      ? `<div style="display:flex; justify-content:space-between;"><span>Coupon Discount${props.couponCode ? ` (${esc(props.couponCode)})` : ''}</span><span>-${fmt(props.discount)}</span></div>`
      : '';

    const trackingLine = props.trackingNumber
      ? `<div style="margin-top:12px;"><span style="color:#4a5568; text-transform:uppercase; font-size:10px; letter-spacing:0.05em;">Tracking Number</span><br/><strong>${esc(props.trackingNumber)}</strong></div>`
      : '';

    const paymentLine = props.paymentHandle
      ? `<div style="margin-top:12px;"><span style="color:#4a5568; text-transform:uppercase; font-size:10px; letter-spacing:0.05em;">Payment Method</span><br/><strong>${esc(props.paymentMethodLabel)}</strong> &mdash; ${esc(props.paymentHandle)}</div>`
      : `<div style="margin-top:12px;"><span style="color:#4a5568; text-transform:uppercase; font-size:10px; letter-spacing:0.05em;">Payment Method</span><br/><strong>${esc(props.paymentMethodLabel)}</strong></div>`;

    const footerHtml = `
      <div class="footer">
        <div style="display:flex; justify-content:space-between;"><span>Subtotal</span><span>${fmt(props.subtotal)}</span></div>
        ${couponLine}
        <div style="display:flex; justify-content:space-between;"><span>Shipping</span><span>${fmt(props.shipping)}</span></div>
        <div style="display:flex; justify-content:space-between; margin-top:8px; padding-top:8px; border-top:1px solid #e2e8f0;">
          <span class="total">Total</span>
          <span class="total">${fmt(props.total)}</span>
        </div>
        ${paymentLine}
        ${trackingLine}
        <div class="disclaimer">
          For In Vitro Research Use Only. Not For Human Or Animal Consumption.
        </div>
      </div>
    `;

    const html = printableHTML({
      title: `Pep Nation Lab Receipt ${orderShort}`,
      headerHtml,
      rowsHtml,
      footerHtml,
    });
    downloadPrintablePDF(html, `receipt-${orderShort}.html`);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="btn btn-secondary"
      style={{ fontSize: '0.85rem' }}
    >
      Download Receipt
    </button>
  );
}
