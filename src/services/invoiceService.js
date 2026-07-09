// Invoice Service - Generates invoice HTML for orders
// Can be extended to generate PDF using libraries like pdfkit

function generateInvoiceHTML(order) {
  const statusColors = {
    pending: '#f59e0b',
    confirmed: '#3b82f6',
    processing: '#8b5cf6',
    shipped: '#06b6d4',
    delivered: '#10b981',
    cancelled: '#ef4444',
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    @page { margin: 20px; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; margin: 0; padding: 20px; }
    .invoice { max-width: 800px; margin: 0 auto; background: white; }
    .header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb; }
    .shop-name { font-size: 28px; font-weight: 700; color: #4f46e5; margin: 0; }
    .invoice-title { font-size: 22px; font-weight: 600; color: #374151; margin: 5px 0 0; }
    .invoice-meta { text-align: right; }
    .meta-item { margin: 3px 0; font-size: 13px; color: #6b7280; }
    .section { margin-bottom: 25px; }
    .section-title { font-size: 16px; font-weight: 600; color: #374151; margin: 0 0 10px; padding-bottom: 5px; border-bottom: 1px solid #e5e7eb; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f9fafb; padding: 10px 12px; text-align: left; font-size: 13px; font-weight: 600; color: #6b7280; text-transform: uppercase; }
    td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
    .amount { text-align: right; font-weight: 500; }
    .totals { margin-top: 15px; }
    .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .grand-total { font-size: 18px; font-weight: 700; border-top: 2px solid #e5e7eb; padding-top: 10px; margin-top: 5px; }
    .address-box { background: #f9fafb; padding: 15px; border-radius: 8px; font-size: 14px; line-height: 1.6; }
    .address-box p { margin: 2px 0; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; color: white; background: ${statusColors[order.status] || '#6b7280'}; }
    .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div>
        <h1 class="shop-name">ShopEase</h1>
        <p class="invoice-title">TAX INVOICE</p>
      </div>
      <div class="invoice-meta">
        <p class="meta-item"><strong>Invoice #:</strong> INV-${order._id.toString().slice(-10)}</p>
        <p class="meta-item"><strong>Order #:</strong> ${order._id}</p>
        <p class="meta-item"><strong>Date:</strong> ${new Date(order.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <p class="meta-item"><strong>Status:</strong> <span class="status-badge">${order.status}</span></p>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Bill To</h2>
      <div class="address-box">
        <p><strong>${order.shippingAddress.fullName}</strong></p>
        <p>${order.shippingAddress.address}</p>
        <p>${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.pincode}</p>
        <p>Phone: ${order.shippingAddress.phone}</p>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Order Items</h2>
      <table>
        <thead>
          <tr>
            <th style="width:50%">Item</th>
            <th style="width:15%">Qty</th>
            <th style="width:15%">Price</th>
            <th style="width:20%" class="amount">Total</th>
          </tr>
        </thead>
        <tbody>
          ${order.items.map(item => `
            <tr>
              <td>${item.name}</td>
              <td>${item.quantity}</td>
              <td>₹${item.price.toFixed(2)}</td>
              <td class="amount">₹${(item.price * item.quantity).toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="totals">
        <div class="total-row"><span>Subtotal</span><span>₹${order.subtotal.toFixed(2)}</span></div>
        <div class="total-row"><span>Tax (18% GST)</span><span>₹${order.tax.toFixed(2)}</span></div>
        <div class="total-row"><span>Shipping</span><span>${order.shippingCost === 0 ? 'FREE' : '₹' + order.shippingCost.toFixed(2)}</span></div>
        <div class="total-row grand-total"><span>Total</span><span>₹${order.total.toFixed(2)}</span></div>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Payment Information</h2>
      <div class="address-box">
        <p><strong>Method:</strong> ${order.payment?.method?.toUpperCase() || 'N/A'}</p>
        ${order.payment?.razorpayPaymentId ? `<p><strong>Payment ID:</strong> ${order.payment.razorpayPaymentId}</p>` : ''}
        ${order.payment?.paidAt ? `<p><strong>Paid On:</strong> ${new Date(order.payment.paidAt).toLocaleString('en-IN')}</p>` : ''}
        <p><strong>Status:</strong> <span class="status-badge">${order.status}</span></p>
      </div>
    </div>

    <div class="footer">
      <p>Thank you for shopping with ShopEase!</p>
      <p>For any queries, please contact our support team.</p>
    </div>
  </div>
</body>
</html>`;
}

module.exports = { generateInvoiceHTML };