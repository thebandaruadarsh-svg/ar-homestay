import { addDays, diffDays, isValidISODate, todayISO } from "../domain/dates";
import { isMoney } from "../domain/money";
import { canRole, type Action } from "../domain/permissions";
import { isRoomAvailable } from "../domain/availability";
import { previewStayCharge, bookingLedger } from "../domain/billing";
import { SCHEMA_VERSION, type Actor, type AuditLog, type Booking, type BookingSource, type Database, type Guest, type Invoice, type Payment, type PaymentKind, type PaymentMethod, type PaymentStatus, type Role, type Room, type RoomType, type UserAccount } from "../domain/types";
import { createSeed, emptyDatabase } from "./seed";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export interface RoomInput {
  roomNumber: string;
  floor: string;
  roomTypeId: string;
  capacity: number;
  amenities: string[];
  basePrice: number;
  maintenance: boolean;
}

export interface RoomTypeInput {
  name: string;
  description: string;
  defaultRate: number;
  maxOccupancy: number;
  amenities: string[];
  active: boolean;
}

export interface GuestInput {
  fullName: string;
  phone: string;
  email: string;
  idType: string;
  idNumber: string;
}

export interface BookingInput {
  source: BookingSource;
  checkIn: string;
  checkOut: string;
  guestId?: string;
  newGuest?: GuestInput;
  roomId: string;
  agreedNightlyRate: number;
  adults: number;
  children: number;
  checkInNow: boolean;
  idempotencyKey: string;
}

export interface PaymentInput {
  bookingId: string;
  amount: number;
  method: PaymentMethod;
  kind: PaymentKind;
  status: PaymentStatus;
  paidOn: string;
  note: string;
  idempotencyKey: string;
}

export interface UserInput {
  name: string;
  email: string;
  role: Role;
  password: string;
}

export interface HotelPatch {
  name: string;
  logoUrl: string;
  currency: string;
  timeZone: string;
  taxPercent: number;
  checkInTime: string;
  checkOutTime: string;
}

const STORAGE_KEY = "stayflow.demo.v1";

export interface HotelStore {
  mode: "demo" | "api";
  get: () => Database;
  subscribe: (listener: () => void) => () => void;
  today: () => string;
  authenticate: (email: string, password: string) => Result<Actor>;
  saveRoom: (actor: Actor, input: RoomInput, id?: string) => Result<{ id: string }>;
  setMaintenance: (actor: Actor, roomId: string, maintenance: boolean) => Result<{ id: string }>;
  deactivateRoom: (actor: Actor, roomId: string) => Result<{ id: string }>;
  saveRoomType: (actor: Actor, input: RoomTypeInput, id?: string) => Result<{ id: string }>;
  deactivateRoomType: (actor: Actor, roomTypeId: string) => Result<{ id: string }>;
  saveGuest: (actor: Actor, input: GuestInput, id?: string) => Result<{ id: string }>;
  createBooking: (actor: Actor, input: BookingInput) => Result<{ id: string }>;
  cancelBooking: (actor: Actor, bookingId: string, reason: string) => Result<{ id: string }>;
  markNoShow: (actor: Actor, bookingId: string) => Result<{ id: string }>;
  checkIn: (actor: Actor, bookingId: string) => Result<{ id: string }>;
  checkOut: (actor: Actor, bookingId: string) => Result<{ id: string }>;
  addInvoiceLine: (actor: Actor, invoiceId: string, description: string, amount: number) => Result<{ id: string }>;
  voidInvoice: (actor: Actor, invoiceId: string) => Result<{ id: string }>;
  recordPayment: (actor: Actor, input: PaymentInput) => Result<{ id: string }>;
  saveUser: (actor: Actor, input: UserInput, id?: string) => Result<{ id: string }>;
  deactivateUser: (actor: Actor, userId: string) => Result<{ id: string }>;
  updateHotel: (actor: Actor, patch: HotelPatch) => Result<{ id: string }>;
  resetDemo: (actor: Actor) => Result<{ id: string }>;
}

export interface StoreOptions {
  mode?: "demo" | "api";
  persist?: boolean;
  today?: string;
  now?: string;
  storage?: Storage;
}

export function createHotelStore(options: StoreOptions = {}): HotelStore {
  const mode = options.mode ?? "api";
  const persist = options.persist ?? false;
  const storage = options.storage;
  const listeners = new Set<() => void>();
  let state = initialState();

  function clockToday(): string {
    if (options.today) return options.today;
    return todayISO(state.hotel.timeZone || "Asia/Kolkata");
  }

  function nowIso(): string {
    return options.now ?? new Date().toISOString();
  }

  function initialState(): Database {
    const cached = readCache();
    const today = options.today ?? todayISO(cached?.hotel.timeZone || "Asia/Kolkata");
    if (cached) return realign(cached, today);
    return mode === "demo" ? createSeed(today) : emptyDatabase(today);
  }

  function readCache(): Database | null {
    if (!persist || !storage) return null;
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Database;
      if (parsed.schemaVersion !== SCHEMA_VERSION) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function emit(): void {
    if (persist && storage) {
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // Keep the in-memory hotel if the browser cannot store it.
      }
    }
    listeners.forEach((listener) => listener());
  }

  function commit(next: Database): void {
    state = next;
    emit();
  }

  function fail(error: string): Result<{ id: string }> {
    return { ok: false, error };
  }

  function deny(actor: Actor, action: Action): string | null {
    return canRole(actor.role, action) ? null : "You are not allowed to do that.";
  }

  function audit(actor: Actor, action: string, entity: string, entityId: string, summary: string): AuditLog {
    return { id: crypto.randomUUID(), at: nowIso(), actorId: actor.id, actorName: actor.name, action, entity, entityId, summary };
  }

  return {
    mode,
    get: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    today: clockToday,
    authenticate: (email, password) => {
      if (mode !== "demo") return { ok: false, error: "The hotel API is not connected yet." };
      const user = state.users.find((item) => item.email.toLowerCase() === email.trim().toLowerCase());
      if (!user || !user.active || user.password !== password) return { ok: false, error: "Those sign-in details do not match an active user." };
      return { ok: true, data: { id: user.id, name: user.name, role: user.role } };
    },
    saveRoom: (actor, input, id) => {
      const denied = deny(actor, "rooms.manage");
      if (denied) return fail(denied);
      const error = validateRoom(state, input, id);
      if (error) return fail(error);
      if (id && !state.rooms.some((room) => room.id === id)) return fail("Room not found.");
      const roomId = id ?? crypto.randomUUID();
      const nextRoom: Room = {
        id: roomId,
        roomNumber: input.roomNumber.trim(),
        floor: input.floor.trim(),
        roomTypeId: input.roomTypeId,
        capacity: input.capacity,
        amenities: cleanList(input.amenities),
        basePrice: input.basePrice,
        inventoryStatus: id ? state.rooms.find((room) => room.id === id)!.inventoryStatus : "active",
        maintenance: input.maintenance,
      };
      const rooms = id ? state.rooms.map((room) => (room.id === id ? nextRoom : room)) : [...state.rooms, nextRoom];
      commit({
        ...state,
        rooms,
        auditLogs: [audit(actor, id ? "room.update" : "room.create", "room", roomId, `Room ${nextRoom.roomNumber} saved. Existing agreed rates were left unchanged.`), ...state.auditLogs],
      });
      return { ok: true, data: { id: roomId } };
    },
    setMaintenance: (actor, roomId, maintenance) => {
      const denied = deny(actor, "rooms.manage");
      if (denied) return fail(denied);
      const room = state.rooms.find((item) => item.id === roomId);
      if (!room) return fail("Room not found.");
      commit({
        ...state,
        rooms: state.rooms.map((item) => (item.id === roomId ? { ...item, maintenance } : item)),
        auditLogs: [audit(actor, "room.maintenance", "room", roomId, `Room ${room.roomNumber} maintenance ${maintenance ? "started" : "cleared"}.`), ...state.auditLogs],
      });
      return { ok: true, data: { id: roomId } };
    },
    deactivateRoom: (actor, roomId) => {
      const denied = deny(actor, "rooms.manage");
      if (denied) return fail(denied);
      const room = state.rooms.find((item) => item.id === roomId);
      if (!room) return fail("Room not found.");
      const today = clockToday();
      const openStay = state.bookings.find(
        (booking) =>
          booking.roomId === roomId &&
          (booking.status === "checked_in" || (booking.status === "confirmed" && booking.checkOut > today)),
      );
      if (openStay) return fail("Cancel open reservations or check the guest out before deactivating this room. History is kept either way.");
      commit({
        ...state,
        rooms: state.rooms.map((item) => (item.id === roomId ? { ...item, inventoryStatus: "inactive", maintenance: false } : item)),
        auditLogs: [audit(actor, "room.deactivate", "room", roomId, `Room ${room.roomNumber} deactivated. Bookings and invoices were kept.`), ...state.auditLogs],
      });
      return { ok: true, data: { id: roomId } };
    },
    saveRoomType: (actor, input, id) => {
      const denied = deny(actor, "rates.manage");
      if (denied) return fail(denied);
      const error = validateRoomType(input);
      if (error) return fail(error);
      const typeId = id ?? crypto.randomUUID();
      const next: RoomType = {
        id: typeId,
        name: input.name.trim(),
        description: input.description.trim(),
        defaultRate: input.defaultRate,
        maxOccupancy: input.maxOccupancy,
        amenities: cleanList(input.amenities),
        active: input.active,
      };
      const roomTypes = id ? state.roomTypes.map((type) => (type.id === id ? next : type)) : [...state.roomTypes, next];
      commit({
        ...state,
        roomTypes,
        auditLogs: [audit(actor, id ? "roomType.update" : "roomType.create", "roomType", typeId, `Room type ${next.name} saved. Existing reservations kept their agreed rates.`), ...state.auditLogs],
      });
      return { ok: true, data: { id: typeId } };
    },
    deactivateRoomType: (actor, roomTypeId) => {
      const denied = deny(actor, "rates.manage");
      if (denied) return fail(denied);
      const type = state.roomTypes.find((item) => item.id === roomTypeId);
      if (!type) return fail("Room type not found.");
      commit({
        ...state,
        roomTypes: state.roomTypes.map((item) => (item.id === roomTypeId ? { ...item, active: false } : item)),
        auditLogs: [audit(actor, "roomType.deactivate", "roomType", roomTypeId, `${type.name} deactivated. Existing rooms and bookings still reference it.`), ...state.auditLogs],
      });
      return { ok: true, data: { id: roomTypeId } };
    },
    saveGuest: (actor, input, id) => {
      const denied = deny(actor, "guests.manage");
      if (denied) return fail(denied);
      const error = validateGuest(input);
      if (error) return fail(error);
      const guestId = id ?? crypto.randomUUID();
      const next: Guest = {
        id: guestId,
        fullName: input.fullName.trim(),
        phone: input.phone.trim(),
        email: input.email.trim(),
        idType: input.idType.trim(),
        idNumber: input.idNumber.trim(),
      };
      const guests = id ? state.guests.map((guest) => (guest.id === id ? next : guest)) : [...state.guests, next];
      commit({
        ...state,
        guests,
        auditLogs: [audit(actor, id ? "guest.update" : "guest.create", "guest", guestId, `Guest ${next.fullName} saved.`), ...state.auditLogs],
      });
      return { ok: true, data: { id: guestId } };
    },
    createBooking: (actor, input) => {
      const denied = deny(actor, "bookings.manage");
      if (denied) return fail(denied);
      const existing = state.bookings.find((booking) => booking.idempotencyKey === input.idempotencyKey);
      if (existing) return { ok: true, data: { id: existing.id } };
      if (!isValidISODate(input.checkIn) || !isValidISODate(input.checkOut) || input.checkOut <= input.checkIn) {
        return fail("Check-out must be after check-in.");
      }
      const room = state.rooms.find((item) => item.id === input.roomId);
      if (!room) return fail("Choose a room.");
      if (room.inventoryStatus !== "active") return fail("That room is not in active inventory.");
      if (room.maintenance) return fail("That room is under maintenance and cannot be reserved.");
      if (!isRoomAvailable(state, room.id, input.checkIn, input.checkOut)) {
        return fail("That room is already reserved for one or more of those nights.");
      }
      const occupants = input.adults + input.children;
      if (input.adults < 1 || occupants > room.capacity) return fail(`This room holds ${room.capacity} guests.`);
      if (!isMoney(input.agreedNightlyRate)) return fail("Enter a valid agreed nightly rate.");
      let guestId = input.guestId ?? "";
      let guests = state.guests;
      if (!guestId) {
        if (!input.newGuest) return fail("Choose a guest or add one.");
        const guestError = validateGuest(input.newGuest);
        if (guestError) return fail(guestError);
        guestId = crypto.randomUUID();
        guests = [...guests, { id: guestId, fullName: input.newGuest.fullName.trim(), phone: input.newGuest.phone.trim(), email: input.newGuest.email.trim(), idType: input.newGuest.idType.trim(), idNumber: input.newGuest.idNumber.trim() }];
      } else if (!state.guests.some((guest) => guest.id === guestId)) {
        return fail("Guest not found.");
      }
      if (input.checkInNow) {
        if (input.source !== "walk_in") return fail("Only a walk-in can be checked in immediately.");
        if (input.checkIn > clockToday()) return fail("Check-in date is still in the future.");
        if (state.bookings.some((item) => item.roomId === room.id && item.status === "checked_in")) {
          return fail("Check the current guest out before checking a new guest into this room.");
        }
      }
      const booking: Booking = {
        id: crypto.randomUUID(),
        guestId,
        roomId: room.id,
        roomTypeId: room.roomTypeId,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        status: input.checkInNow ? "checked_in" : "confirmed",
        source: input.source,
        agreedNightlyRate: input.agreedNightlyRate,
        adults: input.adults,
        children: input.children,
        createdOn: clockToday(),
        idempotencyKey: input.idempotencyKey,
        seeded: false,
      };
      commit({
        ...state,
        guests,
        bookings: [...state.bookings, booking],
        auditLogs: [audit(actor, "booking.create", "booking", booking.id, `Reserved room ${room.roomNumber} at ${booking.agreedNightlyRate} per night.`), ...state.auditLogs],
      });
      return { ok: true, data: { id: booking.id } };
    },
    cancelBooking: (actor, bookingId, reason) => {
      const denied = deny(actor, "bookings.manage");
      if (denied) return fail(denied);
      const booking = state.bookings.find((item) => item.id === bookingId);
      if (!booking) return fail("Booking not found.");
      if (booking.status !== "confirmed") return fail("Only a confirmed reservation can be cancelled.");
      if (!reason.trim()) return fail("Add a cancellation reason.");
      return replaceBooking(actor, { ...booking, status: "cancelled", cancelReason: reason.trim(), seeded: false }, "booking.cancel", "Reservation cancelled. Payments and invoices were kept.");
    },
    markNoShow: (actor, bookingId) => {
      const denied = deny(actor, "bookings.manage");
      if (denied) return fail(denied);
      const booking = state.bookings.find((item) => item.id === bookingId);
      if (!booking) return fail("Booking not found.");
      if (booking.status !== "confirmed") return fail("Only a confirmed reservation can be marked as a no-show.");
      if (booking.checkIn > clockToday()) return fail("A no-show can be recorded on or after the check-in date.");
      return replaceBooking(actor, { ...booking, status: "no_show", seeded: false }, "booking.no_show", "Reservation marked as a no-show.");
    },
    checkIn: (actor, bookingId) => {
      const denied = deny(actor, "frontdesk.operate");
      if (denied) return fail(denied);
      const booking = state.bookings.find((item) => item.id === bookingId);
      if (!booking) return fail("Booking not found.");
      if (booking.status !== "confirmed") return fail("Check-in starts from a confirmed reservation.");
      const today = clockToday();
      if (booking.checkIn > today) return fail("This reservation has not reached its check-in date.");
      if (today > booking.checkOut) return fail("This reservation has already ended.");
      const room = state.rooms.find((item) => item.id === booking.roomId);
      if (!room || room.maintenance || room.inventoryStatus !== "active") return fail("The room is not ready for check-in.");
      return replaceBooking(actor, { ...booking, status: "checked_in", seeded: false }, "booking.check_in", `Checked in to room ${room.roomNumber}.`);
    },
    checkOut: (actor, bookingId) => {
      const denied = deny(actor, "frontdesk.operate");
      if (denied) return fail(denied);
      const booking = state.bookings.find((item) => item.id === bookingId);
      if (!booking) return fail("Booking not found.");
      if (booking.status !== "checked_in") return fail("Check-out starts from a guest who is checked in.");
      const room = state.rooms.find((item) => item.id === booking.roomId);
      let invoices = state.invoices;
      const issued = invoices.find((invoice) => invoice.bookingId === bookingId && invoice.status === "issued");
      if (!issued && room) {
        const preview = previewStayCharge(booking, state.hotel.taxPercent, room.roomNumber);
        const invoice: Invoice = {
          id: crypto.randomUUID(),
          bookingId,
          guestId: booking.guestId,
          issuedOn: clockToday(),
          status: "issued",
          taxPercent: state.hotel.taxPercent,
          lines: preview.lines.map((line) => ({ ...line, id: crypto.randomUUID() })),
          seeded: false,
        };
        invoices = [...invoices, invoice];
      }
      const nextBooking = { ...booking, status: "checked_out" as const, seeded: false };
      commit({
        ...state,
        invoices,
        bookings: state.bookings.map((item) => (item.id === bookingId ? nextBooking : item)),
        auditLogs: [audit(actor, "booking.check_out", "booking", bookingId, `Checked out of room ${room?.roomNumber ?? ""}.`), ...state.auditLogs],
      });
      return { ok: true, data: { id: bookingId } };
    },
    addInvoiceLine: (actor, invoiceId, description, amount) => {
      const denied = deny(actor, "invoices.manage");
      if (denied) return fail(denied);
      const invoice = state.invoices.find((item) => item.id === invoiceId);
      if (!invoice || invoice.status !== "issued") return fail("Issued invoice not found.");
      if (!description.trim() || !isMoney(amount) || amount <= 0) return fail("Enter a description and a charge greater than zero.");
      const next = { ...invoice, seeded: false, lines: [...invoice.lines, { id: crypto.randomUUID(), description: description.trim(), amount }] };
      commit({
        ...state,
        invoices: state.invoices.map((item) => (item.id === invoiceId ? next : item)),
        auditLogs: [audit(actor, "invoice.line", "invoice", invoiceId, `Added ${description.trim()}.`), ...state.auditLogs],
      });
      return { ok: true, data: { id: invoiceId } };
    },
    voidInvoice: (actor, invoiceId) => {
      const denied = deny(actor, "reports.financial");
      if (denied) return fail(denied);
      const invoice = state.invoices.find((item) => item.id === invoiceId);
      if (!invoice) return fail("Invoice not found.");
      commit({
        ...state,
        invoices: state.invoices.map((item) => (item.id === invoiceId ? { ...item, status: "void", seeded: false } : item)),
        auditLogs: [audit(actor, "invoice.void", "invoice", invoiceId, "Invoice voided. The record was kept."), ...state.auditLogs],
      });
      return { ok: true, data: { id: invoiceId } };
    },
    recordPayment: (actor, input) => {
      const action: Action = input.kind === "refund" ? "payments.refund" : "payments.record";
      const denied = deny(actor, action);
      if (denied) return fail(denied);
      const existing = state.payments.find((payment) => payment.idempotencyKey === input.idempotencyKey);
      if (existing) return { ok: true, data: { id: existing.id } };
      const booking = state.bookings.find((item) => item.id === input.bookingId);
      if (!booking) return fail("Booking not found.");
      if (!isMoney(input.amount) || input.amount <= 0) return fail("Enter a payment amount greater than zero.");
      if (!isValidISODate(input.paidOn)) return fail("Enter the payment date.");
      if (input.kind === "refund") {
        const received = bookingLedger(state, booking.id);
        const net = received.collections + received.advances - received.refunds;
        if (input.status === "successful" && input.amount > net) return fail("Refund exceeds the net amount received on this booking.");
      }
      const payment: Payment = {
        id: crypto.randomUUID(),
        bookingId: booking.id,
        guestId: booking.guestId,
        invoiceId: state.invoices.find((invoice) => invoice.bookingId === booking.id && invoice.status === "issued")?.id ?? null,
        amount: input.amount,
        method: input.method,
        kind: input.kind,
        status: input.status,
        paidOn: input.paidOn,
        idempotencyKey: input.idempotencyKey,
        seeded: false,
        note: input.note.trim(),
      };
      commit({
        ...state,
        payments: [...state.payments, payment],
        auditLogs: [audit(actor, "payment.record", "payment", payment.id, `${payment.status} ${payment.kind} of ${payment.amount} recorded.`), ...state.auditLogs],
      });
      return { ok: true, data: { id: payment.id } };
    },
    saveUser: (actor, input, id) => {
      const denied = deny(actor, "users.manage");
      if (denied) return fail(denied);
      if (!input.name.trim() || !input.email.trim() || !input.password.trim()) return fail("Name, email, and password are required.");
      const email = input.email.trim().toLowerCase();
      if (state.users.some((user) => user.email.toLowerCase() === email && user.id !== id)) return fail("That email is already in use.");
      const userId = id ?? crypto.randomUUID();
      const previous = state.users.find((user) => user.id === id);
      const next: UserAccount = {
        id: userId,
        name: input.name.trim(),
        email,
        role: input.role,
        active: previous?.active ?? true,
        password: input.password,
      };
      const users = id ? state.users.map((user) => (user.id === id ? next : user)) : [...state.users, next];
      commit({
        ...state,
        users,
        auditLogs: [audit(actor, id ? "user.update" : "user.create", "user", userId, `User ${next.name} saved as ${next.role}.`), ...state.auditLogs],
      });
      return { ok: true, data: { id: userId } };
    },
    deactivateUser: (actor, userId) => {
      const denied = deny(actor, "users.manage");
      if (denied) return fail(denied);
      if (actor.id === userId) return fail("You cannot deactivate your own account.");
      const user = state.users.find((item) => item.id === userId);
      if (!user) return fail("User not found.");
      const owners = state.users.filter((item) => item.role === "owner" && item.active && item.id !== userId);
      if (user.role === "owner" && owners.length === 0) return fail("Keep at least one active owner.");
      commit({
        ...state,
        users: state.users.map((item) => (item.id === userId ? { ...item, active: false } : item)),
        auditLogs: [audit(actor, "user.deactivate", "user", userId, `${user.name} deactivated.`), ...state.auditLogs],
      });
      return { ok: true, data: { id: userId } };
    },
    updateHotel: (actor, patch) => {
      const denied = deny(actor, "settings.manage");
      if (denied) return fail(denied);
      if (!patch.name.trim()) return fail("Hotel name is required.");
      if (!patch.currency.trim() || patch.currency.trim().length !== 3) return fail("Use a 3-letter currency code.");
      if (!Number.isFinite(patch.taxPercent) || patch.taxPercent < 0 || patch.taxPercent > 100) return fail("Tax percent must be between 0 and 100.");
      commit({
        ...state,
        hotel: { ...state.hotel, ...patch, name: patch.name.trim(), currency: patch.currency.trim().toUpperCase(), timeZone: patch.timeZone.trim() || "Asia/Kolkata" },
        auditLogs: [audit(actor, "hotel.update", "hotel", state.hotel.id, "Hotel settings updated. Issued invoices kept their tax snapshot."), ...state.auditLogs],
      });
      return { ok: true, data: { id: state.hotel.id } };
    },
    resetDemo: (actor) => {
      const denied = deny(actor, "settings.manage");
      if (denied) return fail(denied);
      if (mode !== "demo") return fail("Demo data is not available in this mode.");
      commit(createSeed(clockToday()));
      return { ok: true, data: { id: "demo" } };
    },
  };

  function replaceBooking(actor: Actor, booking: Booking, action: string, summary: string): Result<{ id: string }> {
    commit({
      ...state,
      bookings: state.bookings.map((item) => (item.id === booking.id ? booking : item)),
      auditLogs: [audit(actor, action, "booking", booking.id, summary), ...state.auditLogs],
    });
    return { ok: true, data: { id: booking.id } };
  }
}

function realign(db: Database, today: string): Database {
  if (db.anchoredOn === today) return db;
  const delta = diffDays(db.anchoredOn, today);
  return {
    ...db,
    anchoredOn: today,
    bookings: db.bookings.map((booking) =>
      booking.seeded
        ? { ...booking, checkIn: addDays(booking.checkIn, delta), checkOut: addDays(booking.checkOut, delta), createdOn: addDays(booking.createdOn, delta) }
        : booking,
    ),
    invoices: db.invoices.map((invoice) => (invoice.seeded ? { ...invoice, issuedOn: addDays(invoice.issuedOn, delta) } : invoice)),
    payments: db.payments.map((payment) => (payment.seeded ? { ...payment, paidOn: addDays(payment.paidOn, delta) } : payment)),
  };
}

function cleanList(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

function validateRoom(db: Database, input: RoomInput, id?: string): string | null {
  if (!input.roomNumber.trim()) return "Room number is required.";
  if (!input.floor.trim()) return "Floor is required.";
  const duplicate = db.rooms.some((room) => room.id !== id && room.roomNumber.trim().toLowerCase() === input.roomNumber.trim().toLowerCase());
  if (duplicate) return "That room number is already used in this hotel.";
  const type = db.roomTypes.find((item) => item.id === input.roomTypeId);
  if (!type) return "Choose a room type.";
  if (!type.active && !id) return "Choose an active room type.";
  if (!Number.isInteger(input.capacity) || input.capacity < 1) return "Capacity must be at least 1.";
  if (!isMoney(input.basePrice)) return "Enter a valid base price.";
  return null;
}

function validateRoomType(input: RoomTypeInput): string | null {
  if (!input.name.trim()) return "Room type name is required.";
  if (!Number.isInteger(input.maxOccupancy) || input.maxOccupancy < 1) return "Maximum occupancy must be at least 1.";
  if (!isMoney(input.defaultRate)) return "Enter a valid default rate.";
  return null;
}

function validateGuest(input: GuestInput): string | null {
  if (!input.fullName.trim()) return "Guest name is required.";
  if (!input.phone.trim()) return "Phone number is required.";
  return null;
}
