import type { Role } from "./types";

export const ACTIONS = [
  "dashboard.view",
  "rooms.view",
  "rooms.manage",
  "rates.manage",
  "bookings.manage",
  "guests.manage",
  "guests.viewPii",
  "frontdesk.operate",
  "invoices.manage",
  "payments.record",
  "payments.refund",
  "reports.view",
  "reports.financial",
  "users.manage",
  "settings.manage",
  "audit.view",
] as const;

export type Action = (typeof ACTIONS)[number];

const RECEPTIONIST: Action[] = [
  "dashboard.view",
  "rooms.view",
  "bookings.manage",
  "guests.manage",
  "guests.viewPii",
  "frontdesk.operate",
  "invoices.manage",
  "payments.record",
  "reports.view",
];

const GRANTED: Record<Role, ReadonlySet<Action>> = {
  owner: new Set(ACTIONS),
  receptionist: new Set(RECEPTIONIST),
};

export function canRole(role: Role, action: Action): boolean {
  return GRANTED[role].has(action);
}
