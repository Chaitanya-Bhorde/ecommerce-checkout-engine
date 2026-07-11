// Invoice Service - Generates invoice PDF for orders
const PDFDocument = require('pdfkit');

function generateInvoicePDF(order) {
  // Create a new PDF document
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const buffers = [];
  
  doc.on('data', (chunk) => {
    buffers.push(chunk);
  });

  // Colors
  const primaryColor = '#4f46e5';
  const textColor = '#1f2937';
  const lightGray = '#f9fafb';
  const borderColor = '#e5e7eb';
  const statusColors = {
    pending: '#f59e0b',
    confirmed: '#3b82f6',
    processing: '#8b5cf6',
    shipped: '#06b6d4',
    delivered: '#10b981',
    cancelled: '#ef4444',
  };

  // Header
  doc.fontSize(28).font('Helvetica-Bold').fillColor(primaryColor).text('ShopEase', { align: 'left' });
  doc.moveDown(0.3);
  doc.fontSize(18).font('Helvetica-Bold').fillColor(textColor).text('TAX INVOICE', { align: 'left' });
  
  // Invoice meta (right aligned)
  doc.fontSize(11).font('Helvetica').fillColor('#6b7280');
  const invoiceNumber = `INV-${order._id.toString().slice(-10)}`;
  const orderNumber = order._id.toString();
  const invoiceDate = new Date(order.createdAt).toLocaleDateString('en-IN', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  doc.text(`Invoice #: ${invoiceNumber}`, { align: 'right' });
  doc.text(`Order #: ${orderNumber}`, { align: 'right' });
  doc.text(`Date: ${invoiceDate}`, { align: 'right' });
  
  const statusColor = statusColors[order.status] || '#6b7280';
  doc.fillColor(statusColor).text(`Status: ${order.status.toUpperCase()}`, { align: 'right' });
  
  // Horizontal line
  doc.moveDown(0.5);
  doc.strokeColor(borderColor).lineWidth(2).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(1);

  // Bill To Section
  doc.fontSize(14).font('Helvetica-Bold').fillColor(textColor).text('Bill To', { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(11).font('Helvetica').fillColor(textColor);
  
  const shippingAddress = order.shippingAddress;
  const fullName = shippingAddress.fullName || 'Customer';
  const address = shippingAddress.address || '';
  const city = shippingAddress.city || '';
  const state = shippingAddress.state || '';
  const zipCode = shippingAddress.zipCode || shippingAddress.pincode || '';
  const phone = shippingAddress.phone || '';
  
  doc.font('Helvetica-Bold').text(fullName);
  doc.font('Helvetica').text(address);
  doc.text(`${city}, ${state} - ${zipCode}`);
  doc.text(`Phone: ${phone}`);
  
  // Draw box around address
  const addressBoxHeight = 70;
  doc.y -= 10;
  doc.rect(50, doc.y, 495, addressBoxHeight).fill(lightGray).stroke(borderColor);
  doc.y += addressBoxHeight + 15;

  // Order Items Section
  doc.fontSize(14).font('Helvetica-Bold').fillColor(textColor).text('Order Items', { underline: true });
  doc.moveDown(0.5);

  // Table header
  const tableTop = doc.y;
  const colWidths = [250, 70, 100, 125]; // Item, Qty, Price, Total
  const startX = 50;
  
  doc.rect(startX, tableTop, colWidths[0], 25).fill('#f9fafb').stroke(borderColor);
  doc.rect(startX + colWidths[0], tableTop, colWidths[1], 25).fill('#f9fafb').stroke(borderColor);
  doc.rect(startX + colWidths[0] + colWidths[1], tableTop, colWidths[2], 25).fill('#f9fafb').stroke(borderColor);
  doc.rect(startX + colWidths[0] + colWidths[1] + colWidths[2], tableTop, colWidths[3], 25).fill('#f9fafb').stroke(borderColor);
  
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#6b7280');
  doc.text('Item', startX + 5, tableTop + 8);
  doc.text('Qty', startX + colWidths[0] + 5, tableTop + 8);
  doc.text('Price', startX + colWidths[0] + colWidths[1] + 5, tableTop + 8);
  doc.text('Total', startX + colWidths[0] + colWidths[1] + colWidths[2] + 5, tableTop + 8, { align: 'right', width: colWidths[3] - 10 });

  // Table rows
  doc.font('Helvetica').fillColor(textColor);
  let rowY = tableTop + 25;
  
  order.items.forEach((item) => {
    const itemTotal = item.price * item.quantity;
    
    doc.rect(startX, rowY, colWidths[0], 30).stroke(borderColor);
    doc.rect(startX + colWidths[0], rowY, colWidths[1], 30).stroke(borderColor);
    doc.rect(startX + colWidths[0] + colWidths[1], rowY, colWidths[2], 30).stroke(borderColor);
    doc.rect(startX + colWidths[0] + colWidths[1] + colWidths[2], rowY, colWidths[3], 30).stroke(borderColor);
    
    doc.fontSize(10).text(item.name, startX + 5, rowY + 10, { width: colWidths[0] - 10 });
    doc.text(item.quantity.toString(), startX + colWidths[0] + 5, rowY + 10);
    doc.text(`₹${item.price.toFixed(2)}`, startX + colWidths[0] + colWidths[1] + 5, rowY + 10);
    doc.text(`₹${itemTotal.toFixed(2)}`, startX + colWidths[0] + colWidths[1] + colWidths[2] + 5, rowY + 10, { align: 'right', width: colWidths[3] - 10 });
    
    rowY += 30;
  });

  doc.y = rowY + 10;

  // Totals
  const totalsX = 350;
  const totalsWidth = 195;
  
  doc.fontSize(11).font('Helvetica').fillColor(textColor);
  doc.text('Subtotal:', totalsX, doc.y);
  doc.text(`₹${order.subtotal.toFixed(2)}`, { align: 'right', width: totalsWidth });
  doc.y += 20;
  
  doc.text('Tax (18% GST):', totalsX, doc.y);
  doc.text(`₹${order.tax.toFixed(2)}`, { align: 'right', width: totalsWidth });
  doc.y += 20;
  
  const shippingText = order.shippingCost === 0 ? 'FREE' : `₹${order.shippingCost.toFixed(2)}`;
  doc.text('Shipping:', totalsX, doc.y);
  doc.text(shippingText, { align: 'right', width: totalsWidth });
  doc.y += 20;
  
  // Grand total with border
  doc.y += 5;
  doc.strokeColor(borderColor).lineWidth(2).moveTo(totalsX, doc.y).lineTo(545, doc.y).stroke();
  doc.y += 10;
  doc.fontSize(14).font('Helvetica-Bold').fillColor(primaryColor);
  doc.text('Total:', totalsX, doc.y);
  doc.text(`₹${order.total.toFixed(2)}`, { align: 'right', width: totalsWidth });
  doc.y += 30;

  // Payment Information
  doc.fontSize(14).font('Helvetica-Bold').fillColor(textColor).text('Payment Information', { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(11).font('Helvetica').fillColor(textColor);
  
  const paymentMethod = order.payment?.method?.toUpperCase() || 'N/A';
  doc.font('Helvetica-Bold').text('Method: ');
  doc.font('Helvetica').text(paymentMethod);
  
  if (order.payment?.razorpayPaymentId) {
    doc.font('Helvetica-Bold').text('Payment ID: ');
    doc.font('Helvetica').text(order.payment.razorpayPaymentId);
  }
  
  if (order.payment?.paidAt) {
    const paidOn = new Date(order.payment.paidAt).toLocaleString('en-IN');
    doc.font('Helvetica-Bold').text('Paid On: ');
    doc.font('Helvetica').text(paidOn);
  }
  
  doc.font('Helvetica-Bold').text('Status: ');
  doc.fillColor(statusColor).text(order.status.toUpperCase());

  // Footer
  doc.moveDown(2);
  doc.fontSize(10).font('Helvetica').fillColor('#9ca3af').text('Thank you for shopping with ShopEase!', { align: 'center' });
  doc.text('For any queries, please contact our support team.', { align: 'center' });

  // Finalize the PDF
  doc.end();

  return new Promise((resolve) => {
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer);
    });
  });
}

module.exports = { generateInvoicePDF };