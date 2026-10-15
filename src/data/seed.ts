import { addDays } from "../domain/dates";
import { previewStayCharge } from "../domain/billing";
import { SCHEMA_VERSION, type Booking, type Database, type Invoice, type Payment, type Room } from "../domain/types";

export function emptyDatabase(today: string): Database {
  return {
    schemaVersion: SCHEMA_VERSION,
    anchoredOn: today,
    hotel: {
      id: "hotel_stayflow",
      name: "StayFlow",
      logoUrl: "",
      currency: "INR",
      timeZone: "Asia/Kolkata",
      taxPercent: 0,
      checkInTime: "14:00",
      checkOutTime: "11:00",
    },
    roomTypes: [],
    rooms: [],
    guests: [],
    bookings: [],
    invoices: [],
    payments: [],
    users: [],
    auditLogs: [],
  };
}

function room(
  id: string,
  roomNumber: string,
  floor: string,
  roomTypeId: string,
  capacity: number,
  basePrice: number,
  inventoryStatus: Room["inventoryStatus"] = "active",
  maintenance = false,
): Room {
  return { id, roomNumber, floor, roomTypeId, capacity, amenities: [], basePrice, inventoryStatus, maintenance };
}

function stay(input: Booking): Booking {
  return input;
}

export function createSeed(today: string): Database {
  const hotel = {
    id: "hotel_stayflow",
    name: "StayFlow",
    logoUrl: "",
    currency: "INR",
    timeZone: "Asia/Kolkata",
    taxPercent: 12,
    checkInTime: "14:00",
    checkOutTime: "11:00",
  };
  const roomTypes = [
    { id: "rt_standard", name: "Standard", description: "Quiet room with a queen bed and a work desk.", defaultRate: 2800, maxOccupancy: 2, amenities: ["Wi-Fi", "Air conditioning"], active: true },
    { id: "rt_deluxe", name: "Deluxe", description: "Larger room with a sitting area.", defaultRate: 4200, maxOccupancy: 3, amenities: ["Wi-Fi", "Air conditioning", "Breakfast"], active: true },
    { id: "rt_suite", name: "Suite", description: "Separate living room and a soaking tub.", defaultRate: 7500, maxOccupancy: 3, amenities: ["Wi-Fi", "Bathtub", "Lounge access"], active: true },
    { id: "rt_family", name: "Family", description: "Connecting space for families.", defaultRate: 5600, maxOccupancy: 4, amenities: ["Wi-Fi", "Extra beds", "Breakfast"], active: true },
  ];
  const rooms: Room[] = [
    room("r101", "101", "1", "rt_standard", 2, 2800),
    room("r102", "102", "1", "rt_standard", 2, 2800),
    room("r104", "104", "1", "rt_deluxe", 2, 4200),
    room("r105", "105", "1", "rt_standard", 2, 2800, "active", true),
    room("r107", "107", "1", "rt_family", 4, 5600),
    room("r201", "201", "2", "rt_deluxe", 2, 4500),
    room("r202", "202", "2", "rt_deluxe", 3, 4200),
    room("r204", "204", "2", "rt_suite", 3, 7500),
    room("r206", "206", "2", "rt_standard", 2, 2800),
    room("r301", "301", "3", "rt_family", 4, 5600),
    room("r302", "302", "3", "rt_suite", 3, 8000),
    room("r303", "303", "3", "rt_deluxe", 2, 4200),
    room("r305", "305", "3", "rt_standard", 2, 2800, "inactive"),
    room("r401", "401", "4", "rt_suite", 4, 7500),
    room("rG1", "G1", "G", "rt_standard", 2, 2500),
    room("rM2", "M2", "M", "rt_deluxe", 2, 4200),
  ];
  const guests = [
    { id: "g_ananya", fullName: "Ananya Rao", phone: "9845011122", email: "ananya.rao@email.com", idType: "Aadhaar", idNumber: "XXXX-4412" },
    { id: "g_vikram", fullName: "Vikram Shah", phone: "9845022233", email: "vikram.shah@email.com", idType: "Passport", idNumber: "Z449210" },
    { id: "g_meera", fullName: "Meera Iyer", phone: "9845033344", email: "meera.iyer@email.com", idType: "Driving licence", idNumber: "KA03-9912" },
    { id: "g_john", fullName: "John Mathew", phone: "9845044455", email: "john.mathew@email.com", idType: "Passport", idNumber: "M882110" },
    { id: "g_priya", fullName: "Priya Nair", phone: "9845055566", email: "priya.nair@email.com", idType: "Aadhaar", idNumber: "XXXX-2201" },
    { id: "g_kabir", fullName: "Kabir Khan", phone: "9845066677", email: "kabir.khan@email.com", idType: "Passport", idNumber: "P110293" },
    { id: "g_sara", fullName: "Sara Ali", phone: "9845077788", email: "sara.ali@email.com", idType: "Aadhaar", idNumber: "XXXX-7781" },
    { id: "g_dev", fullName: "Dev Patel", phone: "9845088899", email: "dev.patel@email.com", idType: "Passport", idNumber: "L220184" },
  ];
  const bookings: Booking[] = [
    stay({ id: "b_ananya", guestId: "g_ananya", roomId: "r101", roomTypeId: "rt_standard", checkIn: addDays(today, -1), checkOut: addDays(today, 2), status: "checked_in", source: "advance", agreedNightlyRate: 2800, adults: 2, children: 0, createdOn: addDays(today, -10), idempotencyKey: "seed_b_ananya", seeded: true }),
    stay({ id: "b_vikram", guestId: "g_vikram", roomId: "r102", roomTypeId: "rt_standard", checkIn: today, checkOut: addDays(today, 2), status: "confirmed", source: "advance", agreedNightlyRate: 2800, adults: 1, children: 0, createdOn: addDays(today, -4), idempotencyKey: "seed_b_vikram", seeded: true }),
    stay({ id: "b_meera", guestId: "g_meera", roomId: "r104", roomTypeId: "rt_deluxe", checkIn: addDays(today, -2), checkOut: today, status: "checked_in", source: "walk_in", agreedNightlyRate: 4200, adults: 2, children: 0, createdOn: addDays(today, -2), idempotencyKey: "seed_b_meera", seeded: true }),
    stay({ id: "b_kabir", guestId: "g_kabir", roomId: "r202", roomTypeId: "rt_deluxe", checkIn: addDays(today, -1), checkOut: addDays(today, 3), status: "checked_in", source: "advance", agreedNightlyRate: 4200, adults: 2, children: 1, createdOn: addDays(today, -6), idempotencyKey: "seed_b_kabir", seeded: true }),
    stay({ id: "b_priya", guestId: "g_priya", roomId: "r204", roomTypeId: "rt_suite", checkIn: today, checkOut: addDays(today, 2), status: "confirmed", source: "advance", agreedNightlyRate: 7500, adults: 2, children: 0, createdOn: addDays(today, -3), idempotencyKey: "seed_b_priya", seeded: true }),
    stay({ id: "b_john_future", guestId: "g_john", roomId: "r201", roomTypeId: "rt_deluxe", checkIn: addDays(today, 4), checkOut: addDays(today, 7), status: "confirmed", source: "advance", agreedNightlyRate: 4500, adults: 2, children: 0, createdOn: addDays(today, -1), idempotencyKey: "seed_b_john_future", seeded: true }),
    stay({ id: "b_sara_cancel", guestId: "g_sara", roomId: "r206", roomTypeId: "rt_standard", checkIn: addDays(today, 2), checkOut: addDays(today, 4), status: "cancelled", source: "advance", agreedNightlyRate: 2800, adults: 1, children: 0, createdOn: addDays(today, -8), idempotencyKey: "seed_b_sara_cancel", seeded: true, cancelReason: "Guest cancelled" }),
    stay({ id: "b_noshow", guestId: "g_sara", roomId: "r107", roomTypeId: "rt_family", checkIn: addDays(today, -1), checkOut: addDays(today, 1), status: "no_show", source: "advance", agreedNightlyRate: 5600, adults: 3, children: 1, createdOn: addDays(today, -12), idempotencyKey: "seed_b_noshow", seeded: true }),
    stay({ id: "b_john_past", guestId: "g_john", roomId: "r301", roomTypeId: "rt_family", checkIn: addDays(today, -6), checkOut: addDays(today, -4), status: "checked_out", source: "walk_in", agreedNightlyRate: 5600, adults: 2, children: 2, createdOn: addDays(today, -7), idempotencyKey: "seed_b_john_past", seeded: true }),
    stay({ id: "b_dev_history", guestId: "g_dev", roomId: "r305", roomTypeId: "rt_standard", checkIn: addDays(today, -20), checkOut: addDays(today, -17), status: "checked_out", source: "walk_in", agreedNightlyRate: 2800, adults: 1, children: 0, createdOn: addDays(today, -21), idempotencyKey: "seed_b_dev", seeded: true }),
    stay({ id: "b_sara_future", guestId: "g_sara", roomId: "r302", roomTypeId: "rt_suite", checkIn: addDays(today, 5), checkOut: addDays(today, 8), status: "confirmed", source: "advance", agreedNightlyRate: 8000, adults: 2, children: 0, createdOn: today, idempotencyKey: "seed_b_sara_future", seeded: true }),
  ];

  const draft: Database = {
    schemaVersion: SCHEMA_VERSION,
    anchoredOn: today,
    hotel,
    roomTypes,
    rooms,
    guests,
    bookings,
    invoices: [],
    payments: [],
    users: [
      { id: "user_owner", name: "Asha Menon", email: "owner@stayflow.demo", role: "owner", active: true, password: "stayflow-owner" },
      { id: "user_desk", name: "Rohan Desai", email: "desk@stayflow.demo", role: "receptionist", active: true, password: "stayflow-desk" },
    ],
    auditLogs: [
      {
        id: "audit_seed",
        at: `${today}T08:00:00.000Z`,
        actorId: "user_owner",
        actorName: "Asha Menon",
        action: "seed",
        entity: "hotel",
        entityId: hotel.id,
        summary: "Demo hotel loaded for local development.",
      },
    ],
  };

  const invoiceFor = (bookingId: string, issuedOn: string): Invoice => {
    const booking = bookings.find((item) => item.id === bookingId)!;
    const roomRecord = rooms.find((item) => item.id === booking.roomId)!;
    const preview = previewStayCharge(booking, hotel.taxPercent, roomRecord.roomNumber);
    return {
      id: `inv_${bookingId}`,
      bookingId,
      guestId: booking.guestId,
      issuedOn,
      status: "issued",
      taxPercent: hotel.taxPercent,
      lines: preview.lines,
      seeded: true,
    };
  };

  draft.invoices = [
    invoiceFor("b_ananya", addDays(today, -1)),
    invoiceFor("b_meera", today),
    invoiceFor("b_kabir", addDays(today, -1)),
    invoiceFor("b_john_past", addDays(today, -4)),
    invoiceFor("b_dev_history", addDays(today, -17)),
  ];

  const pay = (input: Payment): Payment => input;
  draft.payments = [
    pay({ id: "pay_ananya", bookingId: "b_ananya", guestId: "g_ananya", invoiceId: "inv_b_ananya", amount: 3000, method: "upi", kind: "collection", status: "successful", paidOn: addDays(today, -1), idempotencyKey: "seed_pay_ananya", seeded: true, note: "Partial stay payment" }),
    pay({ id: "pay_vikram_adv", bookingId: "b_vikram", guestId: "g_vikram", invoiceId: null, amount: 2800, method: "card", kind: "advance", status: "successful", paidOn: today, idempotencyKey: "seed_pay_vikram", seeded: true, note: "Advance for arrival" }),
    pay({ id: "pay_meera", bookingId: "b_meera", guestId: "g_meera", invoiceId: "inv_b_meera", amount: 5000, method: "cash", kind: "collection", status: "successful", paidOn: today, idempotencyKey: "seed_pay_meera", seeded: true, note: "Part payment at desk" }),
    pay({ id: "pay_meera_pending", bookingId: "b_meera", guestId: "g_meera", invoiceId: "inv_b_meera", amount: 1500, method: "upi", kind: "collection", status: "pending", paidOn: today, idempotencyKey: "seed_pay_meera_pending", seeded: true, note: "UPI not confirmed" }),
    pay({ id: "pay_meera_failed", bookingId: "b_meera", guestId: "g_meera", invoiceId: "inv_b_meera", amount: 2000, method: "card", kind: "collection", status: "failed", paidOn: today, idempotencyKey: "seed_pay_meera_failed", seeded: true, note: "Card declined" }),
    pay({ id: "pay_john_pending", bookingId: "b_john_future", guestId: "g_john", invoiceId: null, amount: 2000, method: "bank", kind: "advance", status: "pending", paidOn: today, idempotencyKey: "seed_pay_john_pending", seeded: true, note: "Transfer not cleared" }),
    pay({ id: "pay_john_past", bookingId: "b_john_past", guestId: "g_john", invoiceId: "inv_b_john_past", amount: 12544, method: "card", kind: "collection", status: "successful", paidOn: addDays(today, -4), idempotencyKey: "seed_pay_john_past", seeded: true, note: "Settled at checkout" }),
    pay({ id: "pay_john_refund", bookingId: "b_john_past", guestId: "g_john", invoiceId: "inv_b_john_past", amount: 500, method: "upi", kind: "refund", status: "successful", paidOn: addDays(today, -3), idempotencyKey: "seed_pay_john_refund", seeded: true, note: "Minibar reversal" }),
    pay({ id: "pay_dev", bookingId: "b_dev_history", guestId: "g_dev", invoiceId: "inv_b_dev_history", amount: 9408, method: "cash", kind: "collection", status: "successful", paidOn: addDays(today, -17), idempotencyKey: "seed_pay_dev", seeded: true, note: "Historical stay" }),
  ];

  return draft;
}
