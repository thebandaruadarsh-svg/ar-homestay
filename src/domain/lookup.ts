import type { Booking, BookingStatus, Database } from "./types";

export interface Alert {
  id: string;
  title: string;
  detail: string;
  href: string;
  tone: "info" | "warn" | "danger";
}

export function buildAlerts(db: Database, today: string): Alert[] {
  const alerts: Alert[] = [];
  const arrivals = db.bookings.filter((booking) => booking.checkIn === today && booking.status === "confirmed");
  if (arrivals.length) {
    alerts.push({
      id: "arrivals",
      title: `${arrivals.length} arrival${arrivals.length === 1 ? "" : "s"} still to check in`,
      detail: "Confirmed reservations due today",
      href: "/frontdesk?tab=arrivals",
      tone: "info",
    });
  }
  const departures = db.bookings.filter((booking) => booking.checkOut === today && booking.status === "checked_in");
  if (departures.length) {
    alerts.push({
      id: "departures",
      title: `${departures.length} departure${departures.length === 1 ? "" : "s"} due today`,
      detail: "Guests still checked in",
      href: "/frontdesk?tab=departures",
      tone: "warn",
    });
  }
  const pending = db.payments.filter((payment) => payment.status === "pending");
  if (pending.length) {
    alerts.push({
      id: "pending",
      title: `${pending.length} payment${pending.length === 1 ? "" : "s"} still pending`,
      detail: "Pending and failed payments are not counted as collections",
      href: "/payments?status=pending",
      tone: "warn",
    });
  }
  const maintenance = db.rooms.filter((room) => room.inventoryStatus === "active" && room.maintenance);
  if (maintenance.length) {
    alerts.push({
      id: "maintenance",
      title: `${maintenance.length} room${maintenance.length === 1 ? "" : "s"} under maintenance`,
      detail: maintenance.map((room) => room.roomNumber).join(", "),
      href: "/rooms?status=maintenance",
      tone: "danger",
    });
  }
  return alerts;
}

export function guestName(db: Pick<Database, "guests">, guestId: string): string {
  return db.guests.find((guest) => guest.id === guestId)?.fullName ?? "Unknown guest";
}

export function roomNumber(db: Pick<Database, "rooms">, roomId: string): string {
  return db.rooms.find((room) => room.id === roomId)?.roomNumber ?? "—";
}

export function roomTypeName(db: Pick<Database, "roomTypes">, roomTypeId: string): string {
  return db.roomTypes.find((type) => type.id === roomTypeId)?.name ?? "Unknown type";
}

export function bookingStatusLabel(status: BookingStatus): string {
  switch (status) {
    case "confirmed":
      return "Confirmed";
    case "checked_in":
      return "Checked in";
    case "checked_out":
      return "Checked out";
    case "cancelled":
      return "Cancelled";
    case "no_show":
      return "No-show";
  }
}

export function bookingMatchesQuery(db: Database, booking: Booking, query: string): boolean {
  const haystack = `${guestName(db, booking.guestId)} ${roomNumber(db, booking.roomId)} ${booking.id}`.toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
}
