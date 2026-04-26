import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { prisma } from '../lib/prisma';

const INVOICE_DIR = path.join(__dirname, '../../uploads/invoices');

export interface InvoiceResult {
  buffer: Buffer;
  absolutePath: string;
  relativeUrl: string;
  fileName: string;
}

export async function generateInvoicePdf(orderId: string): Promise<InvoiceResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      buyer: { select: { storeName: true, address: true, phone: true, email: true } },
      items: true,
    },
  });
  if (!order) throw new Error(`Order ${orderId} not found`);

  const vatRate = parseFloat(process.env.VAT_RATE ?? '0.13');
  const vatAmount = order.subtotal * vatRate;
  const grandTotal = order.subtotal + vatAmount + order.deliveryFee;

  const companyName = process.env.COMPANY_NAME ?? 'DISTRO Nepal Pvt Ltd';
  const companyAddress = process.env.COMPANY_ADDRESS ?? 'Kathmandu Valley, Nepal';
  const companyPan = process.env.COMPANY_PAN ?? '';
  const companyContact = process.env.COMPANY_CONTACT ?? 'support@distro.com.np';

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((resolve, reject) => {
    doc.on('end', () => resolve());
    doc.on('error', reject);
  });

  doc
    .font('Helvetica-Bold').fontSize(18).text('DISTRO Nepal Pvt Ltd', { align: 'center' })
    .fontSize(10).font('Helvetica').text('[ logo ]', { align: 'center' })
    .moveDown(0.3)
    .text(companyAddress, { align: 'center' })
    .text(`PAN: ${companyPan}`, { align: 'center' })
    .moveDown(0.5);

  doc
    .font('Helvetica-Bold').fontSize(14).text('TAX INVOICE', { align: 'center' })
    .moveDown(0.5);

  const confirmedDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  const leftX = 50;
  const rightX = 350;
  const metaY = doc.y;

  doc.font('Helvetica-Bold').fontSize(10);
  doc.text('Bill To:', leftX, metaY);
  doc.text('Invoice No:', rightX, metaY);

  doc.font('Helvetica');
  doc.text(order.buyer.storeName ?? 'N/A', leftX, metaY + 14);
  doc.text(order.buyer.address ?? order.deliveryAddress ?? 'N/A', leftX, metaY + 26, { width: 280 });
  doc.text(order.buyer.phone, leftX, metaY + 50);

  doc.text(order.orderNumber, rightX, metaY + 14);
  doc.font('Helvetica-Bold').text('Confirmed:', rightX, metaY + 26);
  doc.font('Helvetica').text(confirmedDate, rightX + 60, metaY + 26);

  doc.moveDown(5);

  // Items table
  const tableTop = doc.y + 10;
  const colX = { item: 50, ctn: 250, pcs: 320, price: 380, sub: 470 };
  const rowH = 22;

  doc.font('Helvetica-Bold').fontSize(10);
  doc.rect(leftX, tableTop, 510, rowH).fillAndStroke('#1A4BDB', '#1A4BDB');
  doc.fillColor('white');
  doc.text('Item', colX.item + 5, tableTop + 6);
  doc.text('Cartons', colX.ctn, tableTop + 6);
  doc.text('Pcs/Ctn', colX.pcs, tableTop + 6);
  doc.text('Price/Ctn', colX.price, tableTop + 6);
  doc.text('Subtotal', colX.sub, tableTop + 6);
  doc.fillColor('black');

  let rowY = tableTop + rowH;
  doc.font('Helvetica').fontSize(10);
  for (let i = 0; i < order.items.length; i++) {
    const item = order.items[i];
    const bg = i % 2 === 0 ? '#F7F9FF' : 'white';
    doc.rect(leftX, rowY, 510, rowH).fill(bg).stroke('#cccccc');
    doc.fillColor('black');
    doc.text(item.name, colX.item + 5, rowY + 6, { width: 190, ellipsis: true });
    doc.text(String(item.qty), colX.ctn, rowY + 6);
    doc.text('—', colX.pcs, rowY + 6);
    doc.text(`Rs ${item.price.toFixed(2)}`, colX.price, rowY + 6);
    doc.text(`Rs ${item.total.toFixed(2)}`, colX.sub, rowY + 6);
    rowY += rowH;
  }

  doc.y = rowY + 12;

  // Totals
  const totalsX = 350;
  const valX = 470;
  const totalsLine = (label: string, value: string, bold = false) => {
    if (bold) doc.font('Helvetica-Bold'); else doc.font('Helvetica');
    doc.fontSize(10);
    const y = doc.y;
    doc.text(label, totalsX, y);
    doc.text(value, valX, y);
    doc.moveDown(0.4);
  };
  totalsLine('Subtotal:', `Rs ${order.subtotal.toFixed(2)}`);
  totalsLine(`VAT (${(vatRate * 100).toFixed(0)}%):`, `Rs ${vatAmount.toFixed(2)}`);
  if (order.deliveryFee > 0) {
    totalsLine('Delivery Fee:', `Rs ${order.deliveryFee.toFixed(2)}`);
  }
  doc.moveTo(totalsX, doc.y).lineTo(560, doc.y).stroke();
  doc.moveDown(0.3);
  totalsLine('Grand Total:', `Rs ${grandTotal.toFixed(2)}`, true);

  // Footer
  doc
    .moveDown(3)
    .font('Helvetica').fontSize(10).fillColor('#0D1120')
    .text(`Thank you for ordering with ${companyName}.`, { align: 'center' })
    .moveDown(0.3)
    .fontSize(9).fillColor('#666666')
    .text(`Questions? ${companyContact}`, { align: 'center' });

  doc.end();
  await done;

  const buffer = Buffer.concat(chunks);
  if (!fs.existsSync(INVOICE_DIR)) {
    fs.mkdirSync(INVOICE_DIR, { recursive: true });
  }
  const fileName = `order-${orderId}.pdf`;
  const absolutePath = path.join(INVOICE_DIR, fileName);
  fs.writeFileSync(absolutePath, buffer);
  const relativeUrl = `/uploads/invoices/${fileName}`;

  return { buffer, absolutePath, relativeUrl, fileName };
}
