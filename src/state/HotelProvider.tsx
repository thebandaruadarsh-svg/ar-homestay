import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { canRole, type Action } from "../domain/permissions";
import type { Actor } from "../domain/types";
import { createHotelStore, type BookingInput, type GuestInput, type HotelPatch, type HotelStore, type PaymentInput, type Result, type RoomInput, type RoomTypeInput, type UserInput } from "../data/store";

interface HotelContextValue {
  store: HotelStore;
  mode: "demo" | "api";
  today: string;
  actor: Actor | null;
  toast: string | null;
  notify: (message: string) => void;
  can: (action: Action) => boolean;
  signIn: (email: string, password: string) => string | null;
  signOut: () => void;
  saveRoom: (input: RoomInput, id?: string) => Result<{ id: string }>;
  setMaintenance: (roomId: string, maintenance: boolean) => Result<{ id: string }>;
  deactivateRoom: (roomId: string) => Result<{ id: string }>;
  saveRoomType: (input: RoomTypeInput, id?: string) => Result<{ id: string }>;
  deactivateRoomType: (roomTypeId: string) => Result<{ id: string }>;
  saveGuest: (input: GuestInput, id?: string) => Result<{ id: string }>;
  createBooking: (input: BookingInput) => Result<{ id: string }>;
  cancelBooking: (bookingId: string, reason: string) => Result<{ id: string }>;
  markNoShow: (bookingId: string) => Result<{ id: string }>;
  checkIn: (bookingId: string) => Result<{ id: string }>;
  checkOut: (bookingId: string) => Result<{ id: string }>;
  addInvoiceLine: (invoiceId: string, description: string, amount: number) => Result<{ id: string }>;
  voidInvoice: (invoiceId: string) => Result<{ id: string }>;
  recordPayment: (input: PaymentInput) => Result<{ id: string }>;
  saveUser: (input: UserInput, id?: string) => Result<{ id: string }>;
  deactivateUser: (userId: string) => Result<{ id: string }>;
  updateHotel: (patch: HotelPatch) => Result<{ id: string }>;
  resetDemo: () => Result<{ id: string }>;
}

const HotelContext = createContext<HotelContextValue | null>(null);
const SESSION_KEY = "stayflow.session";

function dataMode(): "demo" | "api" {
  return import.meta.env.VITE_DATA_MODE === "demo" ? "demo" : "api";
}

export function HotelProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<HotelStore | null>(null);
  if (!storeRef.current) {
    const mode = dataMode();
    storeRef.current = createHotelStore({
      mode,
      persist: mode === "demo" && typeof localStorage !== "undefined",
      storage: typeof localStorage === "undefined" ? undefined : localStorage,
    });
  }
  const store = storeRef.current;
  const db = useSyncExternalStore(store.subscribe, store.get, store.get);
  const [sessionId, setSessionId] = useState<string | null>(() => {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage.getItem(SESSION_KEY);
  });
  const [toast, setToast] = useState<string | null>(null);
  const user = db.users.find((item) => item.id === sessionId && item.active) ?? null;
  const actor: Actor | null = user ? { id: user.id, name: user.name, role: user.role } : null;

  useEffect(() => {
    if (sessionId && !user) {
      sessionStorage.removeItem(SESSION_KEY);
      setSessionId(null);
    }
  }, [sessionId, user]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const value = useMemo<HotelContextValue>(() => {
    const run = <T,>(task: (current: Actor) => Result<T>): Result<T> => {
      if (!actor) return { ok: false, error: "Sign in to continue." };
      return task(actor);
    };
    return {
      store,
      mode: store.mode,
      today: store.today(),
      actor,
      toast,
      notify: (message) => setToast(message),
      can: (action) => (actor ? canRole(actor.role, action) : false),
      signIn: (email, password) => {
        const result = store.authenticate(email, password);
        if (!result.ok) return result.error;
        sessionStorage.setItem(SESSION_KEY, result.data.id);
        setSessionId(result.data.id);
        return null;
      },
      signOut: () => {
        sessionStorage.removeItem(SESSION_KEY);
        setSessionId(null);
      },
      saveRoom: (input, id) => run((current) => store.saveRoom(current, input, id)),
      setMaintenance: (roomId, maintenance) => run((current) => store.setMaintenance(current, roomId, maintenance)),
      deactivateRoom: (roomId) => run((current) => store.deactivateRoom(current, roomId)),
      saveRoomType: (input, id) => run((current) => store.saveRoomType(current, input, id)),
      deactivateRoomType: (roomTypeId) => run((current) => store.deactivateRoomType(current, roomTypeId)),
      saveGuest: (input, id) => run((current) => store.saveGuest(current, input, id)),
      createBooking: (input) => run((current) => store.createBooking(current, input)),
      cancelBooking: (bookingId, reason) => run((current) => store.cancelBooking(current, bookingId, reason)),
      markNoShow: (bookingId) => run((current) => store.markNoShow(current, bookingId)),
      checkIn: (bookingId) => run((current) => store.checkIn(current, bookingId)),
      checkOut: (bookingId) => run((current) => store.checkOut(current, bookingId)),
      addInvoiceLine: (invoiceId, description, amount) => run((current) => store.addInvoiceLine(current, invoiceId, description, amount)),
      voidInvoice: (invoiceId) => run((current) => store.voidInvoice(current, invoiceId)),
      recordPayment: (input) => run((current) => store.recordPayment(current, input)),
      saveUser: (input, id) => run((current) => store.saveUser(current, input, id)),
      deactivateUser: (userId) => run((current) => store.deactivateUser(current, userId)),
      updateHotel: (patch) => run((current) => store.updateHotel(current, patch)),
      resetDemo: () => run((current) => store.resetDemo(current)),
    };
  }, [actor, store, toast]);

  return <HotelContext.Provider value={value}>{children}</HotelContext.Provider>;
}

export function useHotel(): HotelContextValue & { db: ReturnType<HotelStore["get"]> } {
  const value = useContext(HotelContext);
  if (!value) throw new Error("useHotel must be used inside HotelProvider");
  const db = useSyncExternalStore(value.store.subscribe, value.store.get, value.store.get);
  return { ...value, db, today: value.store.today() };
}
