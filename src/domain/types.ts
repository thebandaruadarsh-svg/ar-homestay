export type Role = "owner" | "receptionist";

export type InventoryStatus = "active" | "inactive";

export type BookingStatus = "confirmed" | "checked_in" | "checked_out" | "cancelled" | "no_show";

export type BookingSource = "walk_in" | "advance";

export type PaymentKind = "collection" | "advance" | "refund";

export type PaymentStatus = "successful" | "pending" | "failed";

export type PaymentMethod = "cash" | "card" | "upi" | "bank";

export type InvoiceStatus = "issued" | "void";

export type OperationalStatus = "available" | "occupied" | "reserved" | "maintenance";

export interface HotelSettings {
  id: string;
  name: string;
  logoUrl: string;
  currency: string;
  timeZone: string;
  taxPercent: number;
  checkInTime: string;
  checkOutTime: string;
}

export interface RoomType {
  id: string;
  name: string;
  description: string;
  defaultRate: number;
  maxOccupancy: number;
  amenities: string[];
  active: boolean;
}

export interface Room {
  id: string;
  roomNumber: string;
  floor: string;
  roomTypeId: string;
  capacity: number;
  amenities: string[];
  basePrice: number;
  inventoryStatus: InventoryStatus;
  maintenance: boolean;
}

export interface Guest {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  idType: string;
  idNumber: string;
}

export interface Booking {
  id: string;
  guestId: string;
  roomId: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  status: BookingStatus;
  source: BookingSource;
  agreedNightlyRate: number;
  adults: number;
  children: number;
  createdOn: string;
  idempotencyKey: string;
  seeded: boolean;
  cancelReason?: string;
}

export interface InvoiceLine {
  id: string;
  description: string;
  amount: number;
}

export interface Invoice {
  id: string;
  bookingId: string;
  guestId: string;
  issuedOn: string;
  status: InvoiceStatus;
  taxPercent: number;
  lines: InvoiceLine[];
  seeded: boolean;
}

export interface Payment {
  id: string;
  bookingId: string;
  guestId: string;
  invoiceId: string | null;
  amount: number;
  method: PaymentMethod;
  kind: PaymentKind;
  status: PaymentStatus;
  paidOn: string;
  idempotencyKey: string;
  seeded: boolean;
  note: string;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  password: string;
}

export interface AuditLog {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  action: string;
  entity: string;
  entityId: string;
  summary: string;
}

export interface Database {
  schemaVersion: number;
  anchoredOn: string;
  hotel: HotelSettings;
  roomTypes: RoomType[];
  rooms: Room[];
  guests: Guest[];
  bookings: Booking[];
  invoices: Invoice[];
  payments: Payment[];
  users: UserAccount[];
  auditLogs: AuditLog[];
}

export interface Actor {
  id: string;
  name: string;
  role: Role;
}

export const SCHEMA_VERSION = 1;

export const BLOCKING_BOOKING_STATUSES: BookingStatus[] = ["confirmed", "checked_in"];
