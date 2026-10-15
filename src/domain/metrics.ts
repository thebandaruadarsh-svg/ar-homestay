import { inRange } from "./dates";
import { bookingLedger, invoiceTotal, ledgerFor } from "./billing";
import { roomOperationalStatus } from "./availability";
import type { Database, OperationalStatus } from "./types";

export interface RoomCounts {
  active: number;
  occupied: number;
  available: number;
  reserved: number;
  maintenance: number;
}

export interface FinancialSummary {
  collections: number;
  invoiced: number;
  advances: number;
  refunds: number;
  outstanding: number;
  credit: number;
}

export interface TrendPoint {
  date: string;
  label: string;
  occupied: number;
  active: number;
  collections: number;
}

export interface DashboardMetrics {
  rooms: RoomCounts;
  arrivals: number;
  departures: number;
  financials: FinancialSummary;
  trend: TrendPoint[];
}

export function countRooms(db: Pick<Database, "rooms" | "bookings">, day: string): RoomCounts {
  const counts: RoomCounts = { active: 0, occupied: 0, available: 0, reserved: 0, maintenance: 0 };
  for (const room of db.rooms) {
    const status = roomOperationalStatus(db, room, day);
    if (status === "inactive") continue;
    counts.active += 1;
    counts[status] += 1;
  }
  return counts;
}

export function financialSummary(db: Pick<Database, "invoices" | "payments" | "bookings">, from: string, to: string): FinancialSummary {
  const collections = db.payments
    .filter((payment) => payment.status === "successful" && payment.kind === "collection" && inRange(payment.paidOn, from, to))
    .reduce((sum, payment) => sum + payment.amount, 0);
  const advances = db.payments
    .filter((payment) => payment.status === "successful" && payment.kind === "advance" && inRange(payment.paidOn, from, to))
    .reduce((sum, payment) => sum + payment.amount, 0);
  const refunds = db.payments
    .filter((payment) => payment.status === "successful" && payment.kind === "refund" && inRange(payment.paidOn, from, to))
    .reduce((sum, payment) => sum + payment.amount, 0);
  const invoiced = db.invoices
    .filter((invoice) => invoice.status === "issued" && inRange(invoice.issuedOn, from, to))
    .reduce((sum, invoice) => sum + invoiceTotal(invoice), 0);
  const openBookings = db.bookings.filter((booking) => booking.status === "confirmed" || booking.status === "checked_in" || booking.status === "checked_out");
  const outstanding = openBookings.reduce((sum, booking) => sum + bookingLedger(db, booking.id).outstanding, 0);
  const credit = openBookings.reduce((sum, booking) => sum + bookingLedger(db, booking.id).credit, 0);
  return {
    collections: round(collections),
    invoiced: round(invoiced),
    advances: round(advances),
    refunds: round(refunds),
    outstanding: round(outstanding),
    credit: round(credit),
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function occupancyTrend(db: Pick<Database, "rooms" | "bookings" | "payments">, from: string, to: string): TrendPoint[] {
  const days = enumerate(from, to);
  const bucketSize = days.length > 31 ? 7 : 1;
  const points: TrendPoint[] = [];
  for (let index = 0; index < days.length; index += bucketSize) {
    const slice = days.slice(index, index + bucketSize);
    const date = slice[0];
    const end = slice[slice.length - 1];
    const counts = countRooms(db, end);
    const collections = db.payments
      .filter((payment) => payment.status === "successful" && payment.kind === "collection" && payment.paidOn >= date && payment.paidOn <= end)
      .reduce((sum, payment) => sum + payment.amount, 0);
    points.push({
      date,
      label: bucketSize === 1 ? date.slice(8) : `${date.slice(8)}–${end.slice(8)}`,
      occupied: counts.occupied,
      active: counts.active,
      collections: round(collections),
    });
  }
  return points;
}

function enumerate(from: string, to: string): string[] {
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    dates.push(cursor);
    const [year, month, day] = cursor.split("-").map(Number);
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    cursor = next.toISOString().slice(0, 10);
  }
  return dates;
}

export function dashboardMetrics(db: Database, day: string, from: string, to: string): DashboardMetrics {
  return {
    rooms: countRooms(db, day),
    arrivals: db.bookings.filter(
      (booking) => booking.checkIn === day && (booking.status === "confirmed" || booking.status === "checked_in"),
    ).length,
    departures: db.bookings.filter((booking) => booking.checkOut === day && booking.status === "checked_in").length,
    financials: financialSummary(db, from, to),
    trend: occupancyTrend(db, from, to),
  };
}

export function periodOutstanding(db: Database): number {
  return ledgerFor(db.invoices, db.payments).outstanding;
}

export function statusLabel(status: OperationalStatus | "inactive"): string {
  switch (status) {
    case "available":
      return "Available";
    case "occupied":
      return "Occupied";
    case "reserved":
      return "Reserved";
    case "maintenance":
      return "Maintenance";
    default:
      return "Deactivated";
  }
}
