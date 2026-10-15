import { diffDays } from "./dates";
import type { Booking, Database, Invoice, InvoiceLine, Payment, PaymentKind, PaymentStatus } from "./types";

export interface ChargePreview {
  nights: number;
  roomCharge: number;
  taxPercent: number;
  taxAmount: number;
  total: number;
  lines: InvoiceLine[];
}

export function stayNights(booking: Pick<Booking, "checkIn" | "checkOut">): number {
  return Math.max(0, diffDays(booking.checkIn, booking.checkOut));
}

export function previewStayCharge(
  booking: Pick<Booking, "id" | "checkIn" | "checkOut" | "agreedNightlyRate" | "roomId">,
  taxPercent: number,
  roomNumber: string,
): ChargePreview {
  const nights = stayNights(booking);
  const roomCharge = roundMoney(nights * booking.agreedNightlyRate);
  const taxAmount = roundMoney((roomCharge * taxPercent) / 100);
  const lines: InvoiceLine[] = [
    {
      id: `line_${booking.id}_room`,
      description: `Room ${roomNumber} · ${nights} night${nights === 1 ? "" : "s"} @ agreed rate`,
      amount: roomCharge,
    },
  ];
  return {
    nights,
    roomCharge,
    taxPercent,
    taxAmount,
    total: roundMoney(roomCharge + taxAmount),
    lines,
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function invoiceSubtotal(invoice: Invoice): number {
  if (invoice.status === "void") return 0;
  return roundMoney(invoice.lines.reduce((sum, line) => sum + line.amount, 0));
}

export function invoiceTax(invoice: Invoice): number {
  if (invoice.status === "void") return 0;
  return roundMoney((invoiceSubtotal(invoice) * invoice.taxPercent) / 100);
}

export function invoiceTotal(invoice: Invoice): number {
  return roundMoney(invoiceSubtotal(invoice) + invoiceTax(invoice));
}

export interface Ledger {
  invoiced: number;
  collections: number;
  advances: number;
  refunds: number;
  outstanding: number;
  credit: number;
}

function sumPayments(
  payments: Payment[],
  kind: PaymentKind,
  status: PaymentStatus = "successful",
): number {
  return roundMoney(
    payments.filter((payment) => payment.kind === kind && payment.status === status).reduce((sum, payment) => sum + payment.amount, 0),
  );
}

export function ledgerFor(invoices: Invoice[], payments: Payment[]): Ledger {
  const invoiced = roundMoney(invoices.reduce((sum, invoice) => sum + invoiceTotal(invoice), 0));
  const collections = sumPayments(payments, "collection");
  const advances = sumPayments(payments, "advance");
  const refunds = sumPayments(payments, "refund");
  const netSettled = roundMoney(collections + advances - refunds);
  return {
    invoiced,
    collections,
    advances,
    refunds,
    outstanding: roundMoney(Math.max(0, invoiced - netSettled)),
    credit: roundMoney(Math.max(0, netSettled - invoiced)),
  };
}

export function bookingLedger(db: Pick<Database, "invoices" | "payments">, bookingId: string): Ledger {
  return ledgerFor(
    db.invoices.filter((invoice) => invoice.bookingId === bookingId),
    db.payments.filter((payment) => payment.bookingId === bookingId),
  );
}

export function guestLedger(db: Pick<Database, "invoices" | "payments" | "bookings">, guestId: string): Ledger {
  const bookingIds = new Set(db.bookings.filter((booking) => booking.guestId === guestId).map((booking) => booking.id));
  return ledgerFor(
    db.invoices.filter((invoice) => invoice.guestId === guestId || bookingIds.has(invoice.bookingId)),
    db.payments.filter((payment) => payment.guestId === guestId || bookingIds.has(payment.bookingId)),
  );
}

export function withLine(invoice: Invoice, line: InvoiceLine): Invoice {
  return { ...invoice, lines: [...invoice.lines, line] };
}
