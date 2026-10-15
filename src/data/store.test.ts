import { describe, expect, it } from "vitest";
import { countRooms, financialSummary } from "../domain/metrics";
import { isRoomAvailable, roomOperationalStatus } from "../domain/availability";
import { addDays } from "../domain/dates";
import type { Actor } from "../domain/types";
import { createHotelStore } from "./store";

const TODAY = "2026-10-12";
const owner: Actor = { id: "user_owner", name: "Asha Menon", role: "owner" };
const desk: Actor = { id: "user_desk", name: "Rohan Desai", role: "receptionist" };

function demo() {
  return createHotelStore({ mode: "demo", today: TODAY, now: `${TODAY}T09:00:00.000Z` });
}

describe("hotel inventory and metrics", () => {
  it("partitions active rooms without double-counting", () => {
    const db = demo().get();
    const counts = countRooms(db, TODAY);
    expect(counts.occupied + counts.available + counts.reserved + counts.maintenance).toBe(counts.active);
    expect(roomOperationalStatus(db, db.rooms.find((room) => room.id === "r105")!, TODAY)).toBe("maintenance");
    expect(roomOperationalStatus(db, db.rooms.find((room) => room.id === "r101")!, TODAY)).toBe("occupied");
    expect(roomOperationalStatus(db, db.rooms.find((room) => room.id === "r102")!, TODAY)).toBe("reserved");
    expect(roomOperationalStatus(db, db.rooms.find((room) => room.id === "r305")!, TODAY)).toBe("inactive");
    expect(counts.active).toBe(db.rooms.filter((room) => room.inventoryStatus === "active").length);
  });

  it("adds a room and updates the active count from the records", () => {
    const store = demo();
    const before = countRooms(store.get(), TODAY).active;
    const created = store.saveRoom(owner, {
      roomNumber: "501",
      floor: "5",
      roomTypeId: "rt_standard",
      capacity: 2,
      amenities: ["Wi-Fi"],
      basePrice: 3000,
      maintenance: false,
    });
    expect(created.ok).toBe(true);
    expect(store.get().rooms.some((room) => room.roomNumber === "501")).toBe(true);
    expect(countRooms(store.get(), TODAY).active).toBe(before + 1);
  });

  it("rejects a duplicate room number", () => {
    const store = demo();
    const created = store.saveRoom(owner, {
      roomNumber: "G1",
      floor: "2",
      roomTypeId: "rt_standard",
      capacity: 2,
      amenities: [],
      basePrice: 2800,
      maintenance: false,
    });
    expect(created.ok).toBe(false);
  });

  it("creates a room type without a fixed list in the operation", () => {
    const store = demo();
    const created = store.saveRoomType(owner, {
      name: "Pool villa",
      description: "Standalone villa",
      defaultRate: 12000,
      maxOccupancy: 4,
      amenities: ["Pool"],
      active: true,
    });
    expect(created.ok).toBe(true);
    expect(store.get().roomTypes.some((type) => type.name === "Pool villa")).toBe(true);
  });

  it("keeps historical bookings when a room is deactivated", () => {
    const store = demo();
    const before = store.get().bookings.filter((booking) => booking.roomId === "r305");
    expect(before.length).toBeGreaterThan(0);
    const result = store.deactivateRoom(owner, "r401");
    expect(result.ok).toBe(true);
    const room = store.get().rooms.find((item) => item.id === "r401");
    expect(room?.inventoryStatus).toBe("inactive");
    expect(store.get().bookings.filter((booking) => booking.roomId === "r305")).toEqual(before);
  });
});

describe("reservations and money", () => {
  it("blocks overlapping reservations and allows a same-day turnover", () => {
    const store = demo();
    const first = store.createBooking(owner, {
      source: "advance",
      checkIn: addDays(TODAY, 1),
      checkOut: addDays(TODAY, 3),
      guestId: "g_dev",
      roomId: "r303",
      agreedNightlyRate: 4200,
      adults: 1,
      children: 0,
      checkInNow: false,
      idempotencyKey: "once",
    });
    expect(first.ok).toBe(true);
    const overlap = store.createBooking(owner, {
      source: "advance",
      checkIn: addDays(TODAY, 2),
      checkOut: addDays(TODAY, 4),
      guestId: "g_dev",
      roomId: "r303",
      agreedNightlyRate: 4200,
      adults: 1,
      children: 0,
      checkInNow: false,
      idempotencyKey: "twice",
    });
    expect(overlap.ok).toBe(false);
    expect(isRoomAvailable(store.get(), "r104", TODAY, addDays(TODAY, 1))).toBe(true);
  });

  it("does not rewrite an agreed rate when defaults change", () => {
    const store = demo();
    const before = store.get().bookings.find((booking) => booking.id === "b_vikram")!.agreedNightlyRate;
    expect(store.saveRoomType(owner, {
      name: "Standard",
      description: "Updated copy",
      defaultRate: 9999,
      maxOccupancy: 2,
      amenities: ["Wi-Fi"],
      active: true,
    }, "rt_standard").ok).toBe(true);
    expect(store.saveRoom(owner, {
      roomNumber: "102",
      floor: "1",
      roomTypeId: "rt_standard",
      capacity: 2,
      amenities: [],
      basePrice: 9999,
      maintenance: false,
    }, "r102").ok).toBe(true);
    expect(store.get().bookings.find((booking) => booking.id === "b_vikram")!.agreedNightlyRate).toBe(before);
  });

  it("counts only successful collections and updates after a real payment", () => {
    const store = demo();
    const before = financialSummary(store.get(), TODAY, TODAY);
    const ignored = store.get().payments.filter((payment) => payment.paidOn === TODAY && payment.status !== "successful");
    expect(ignored.length).toBeGreaterThan(0);
    const expected = store.get().payments
      .filter((payment) => payment.paidOn === TODAY && payment.status === "successful" && payment.kind === "collection")
      .reduce((sum, payment) => sum + payment.amount, 0);
    expect(before.collections).toBe(expected);
    const recorded = store.recordPayment(desk, {
      bookingId: "b_meera",
      amount: 400,
      method: "cash",
      kind: "collection",
      status: "successful",
      paidOn: TODAY,
      note: "Balance",
      idempotencyKey: "desk-400",
    });
    expect(recorded.ok).toBe(true);
    expect(financialSummary(store.get(), TODAY, TODAY).collections).toBe(expected + 400);
    const pending = store.recordPayment(desk, {
      bookingId: "b_meera",
      amount: 50,
      method: "upi",
      kind: "collection",
      status: "pending",
      paidOn: TODAY,
      note: "Waiting",
      idempotencyKey: "desk-50",
    });
    expect(pending.ok).toBe(true);
    expect(financialSummary(store.get(), TODAY, TODAY).collections).toBe(expected + 400);
    const duplicate = store.recordPayment(desk, {
      bookingId: "b_meera",
      amount: 400,
      method: "cash",
      kind: "collection",
      status: "successful",
      paidOn: TODAY,
      note: "Balance",
      idempotencyKey: "desk-400",
    });
    expect(duplicate.ok && duplicate.data.id).toBe(recorded.ok && recorded.data.id);
  });

  it("stops a receptionist from owner-only changes", () => {
    const store = demo();
    expect(store.saveRoom(desk, {
      roomNumber: "777",
      floor: "7",
      roomTypeId: "rt_standard",
      capacity: 2,
      amenities: [],
      basePrice: 1000,
      maintenance: false,
    }).ok).toBe(false);
    expect(store.saveUser(desk, { name: "New", email: "new@stayflow.demo", role: "receptionist", password: "secret-pass" }).ok).toBe(false);
    expect(store.recordPayment(desk, {
      bookingId: "b_john_past",
      amount: 100,
      method: "cash",
      kind: "refund",
      status: "successful",
      paidOn: TODAY,
      note: "No",
      idempotencyKey: "refund-desk",
    }).ok).toBe(false);
  });
});

describe("data mode", () => {
  it("does not load sample metrics when the API mode is selected", () => {
    const store = createHotelStore({ mode: "api", today: TODAY });
    const summary = financialSummary(store.get(), TODAY, TODAY);
    expect(store.get().rooms).toHaveLength(0);
    expect(store.get().bookings).toHaveLength(0);
    expect(countRooms(store.get(), TODAY).active).toBe(0);
    expect(summary.collections).toBe(0);
    expect(summary.invoiced).toBe(0);
    expect(store.authenticate("owner@stayflow.demo", "stayflow-owner").ok).toBe(false);
  });

  it("keeps user-entered dates fixed when demo records roll forward", () => {
    const storage = memoryStorage();
    const first = createHotelStore({ mode: "demo", persist: true, today: TODAY, now: `${TODAY}T09:00:00.000Z`, storage });
    const seededCheckIn = first.get().bookings.find((booking) => booking.id === "b_vikram")!.checkIn;
    const created = first.createBooking(owner, {
      source: "advance",
      checkIn: "2026-11-02",
      checkOut: "2026-11-04",
      guestId: "g_dev",
      roomId: "r401",
      agreedNightlyRate: 7500,
      adults: 2,
      children: 0,
      checkInNow: false,
      idempotencyKey: "fixed-date",
    });
    expect(created.ok).toBe(true);
    const bookingId = created.ok ? created.data.id : "";
    const next = createHotelStore({ mode: "demo", persist: true, today: addDays(TODAY, 1), storage });
    expect(next.get().bookings.find((booking) => booking.id === "b_vikram")!.checkIn).toBe(addDays(seededCheckIn, 1));
    expect(next.get().bookings.find((booking) => booking.id === bookingId)!.checkIn).toBe("2026-11-02");
  });
});

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => {
      map.delete(key);
    },
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}
