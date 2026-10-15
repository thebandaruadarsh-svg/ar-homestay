import type { Booking, Database, OperationalStatus, Room } from "./types";
import { BLOCKING_BOOKING_STATUSES } from "./types";

export function rangesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && startB < endA;
}

export function blockingBookings(db: Pick<Database, "bookings">, roomId: string, excludeBookingId?: string): Booking[] {
  return db.bookings.filter(
    (booking) =>
      booking.roomId === roomId &&
      booking.id !== excludeBookingId &&
      BLOCKING_BOOKING_STATUSES.includes(booking.status),
  );
}

export function roomHasOverlap(
  db: Pick<Database, "bookings">,
  roomId: string,
  checkIn: string,
  checkOut: string,
  excludeBookingId?: string,
): boolean {
  return blockingBookings(db, roomId, excludeBookingId).some((booking) =>
    rangesOverlap(checkIn, checkOut, booking.checkIn, booking.checkOut),
  );
}

export function isRoomSellable(room: Room): boolean {
  return room.inventoryStatus === "active" && !room.maintenance;
}

export function isRoomAvailable(
  db: Pick<Database, "bookings" | "rooms">,
  roomId: string,
  checkIn: string,
  checkOut: string,
  excludeBookingId?: string,
): boolean {
  const room = db.rooms.find((item) => item.id === roomId);
  if (!room || !isRoomSellable(room)) return false;
  if (!(checkOut > checkIn)) return false;
  return !roomHasOverlap(db, roomId, checkIn, checkOut, excludeBookingId);
}

export function availableRooms(
  db: Pick<Database, "bookings" | "rooms">,
  checkIn: string,
  checkOut: string,
  roomTypeId?: string,
): Room[] {
  return db.rooms
    .filter((room) => (roomTypeId ? room.roomTypeId === roomTypeId : true))
    .filter((room) => isRoomAvailable(db, room.id, checkIn, checkOut))
    .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));
}

export function roomOperationalStatus(db: Pick<Database, "bookings">, room: Room, day: string): OperationalStatus | "inactive" {
  if (room.inventoryStatus !== "active") return "inactive";
  const stays = db.bookings.filter((booking) => booking.roomId === room.id);
  const occupied = stays.some((booking) => booking.status === "checked_in" && booking.checkIn <= day);
  if (occupied) return "occupied";
  if (room.maintenance) return "maintenance";
  const reserved = stays.some(
    (booking) => booking.status === "confirmed" && booking.checkIn <= day && day < booking.checkOut,
  );
  if (reserved) return "reserved";
  return "available";
}

export function nextArrivalOn(db: Pick<Database, "bookings">, roomId: string, day: string): Booking | undefined {
  return db.bookings.find(
    (booking) => booking.roomId === roomId && booking.status === "confirmed" && booking.checkIn === day,
  );
}
