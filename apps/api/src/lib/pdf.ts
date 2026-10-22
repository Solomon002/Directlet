import PDFDocument from "pdfkit";
import type { Response } from "express";

interface ReceiptPeriod {
  start: Date;
  end: Date;
  amount: string;
}

interface ReceiptPdfData {
  receiptNumber: string;
  issuedAt: Date;
  tenantName: string;
  propertyName: string;
  unitLabel: string;
  address: string;
  amount: string;
  method: string;
  paidAt: Date;
  periods: ReceiptPeriod[];
}

export function streamReceiptPdf(res: Response, data: ReceiptPdfData) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${data.receiptNumber}.pdf"`);
  doc.pipe(res);

  doc.fontSize(20).fillColor("#0B6E4F").text("DirectLet", { align: "left" });
  doc.fontSize(10).fillColor("#555555").text("Rent Payment Receipt", { align: "left" });
  doc.moveDown(1.5);

  doc.fillColor("#000000").fontSize(12);
  doc.text(`Receipt No: ${data.receiptNumber}`);
  doc.text(`Issued: ${data.issuedAt.toDateString()}`);
  doc.moveDown();

  doc.text(`Tenant: ${data.tenantName}`);
  doc.text(`Property: ${data.propertyName}`);
  doc.text(`Unit: ${data.unitLabel}`);
  doc.text(`Address: ${data.address}`);
  doc.moveDown();

  doc.text(`Amount Paid: NGN ${Number(data.amount).toLocaleString()}`);
  doc.text(`Method: ${data.method}`);
  doc.text(`Paid On: ${data.paidAt.toDateString()}`);
  doc.moveDown();

  doc.fontSize(12).text("Applied To:", { underline: true });
  doc.fontSize(11);
  for (const period of data.periods) {
    doc.text(
      `${period.start.toDateString()} to ${period.end.toDateString()}: NGN ${Number(period.amount).toLocaleString()}`,
    );
  }

  doc.end();
}
