import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { availableRooms } from "../domain/availability";
import { previewStayCharge } from "../domain/billing";
import { roomTypeName } from "../domain/lookup";
import type { BookingSource } from "../domain/types";
import { useHotel } from "../state/HotelProvider";
import { Button, EmptyState, ErrorNote, Field, Money, PageHeader, SelectInput, TextInput } from "../components/ui";

export function BookingFormPage() {
  const { db, today, createBooking, notify } = useHotel();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const preset = params.get("source") === "walk_in" ? "walk_in" : params.get("source") === "advance" ? "advance" : "advance";
  const [source, setSource] = useState<BookingSource>(preset);
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState("");
  const [guestMode, setGuestMode] = useState<"existing" | "new">(db.guests.length ? "existing" : "new");
  const [guestId, setGuestId] = useState(db.guests[0]?.id ?? "");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [typeId, setTypeId] = useState("all");
  const [roomId, setRoomId] = useState("");
  const [rate, setRate] = useState("");
  const [rateDirty, setRateDirty] = useState(false);
  const [adults, setAdults] = useState("1");
  const [children, setChildren] = useState("0");
  const [checkInNow, setCheckInNow] = useState(preset === "walk_in");
  const [error, setError] = useState("");
  const [key] = useState(() => crypto.randomUUID());
  const rooms = useMemo(() => (checkOut > checkIn ? availableRooms(db, checkIn, checkOut, typeId === "all" ? undefined : typeId) : []), [checkIn, checkOut, db, typeId]);
  const selected = rooms.find((room) => room.id === roomId) ?? db.rooms.find((room) => room.id === roomId);
  const preview = selected && checkOut > checkIn && rate !== "" ? previewStayCharge({ id: "preview", checkIn, checkOut, agreedNightlyRate: Number(rate) || 0, roomId: selected.id }, db.hotel.taxPercent, selected.roomNumber) : null;

  useEffect(() => {
    if (roomId && !rooms.some((room) => room.id === roomId)) setRoomId("");
  }, [roomId, rooms]);

  return (
    <div className="page form-page">
      <PageHeader title={source === "walk_in" ? "Walk-in booking" : "Advance booking"} lede="The agreed rate is saved on the reservation. Later price changes do not alter it." />
      <form className="panel form-grid" onSubmit={(event) => {
        event.preventDefault();
        const result = createBooking({
          source,
          checkIn,
          checkOut,
          guestId: guestMode === "existing" ? guestId : undefined,
          newGuest: guestMode === "new" ? { fullName, phone, email, idType: "", idNumber: "" } : undefined,
          roomId,
          agreedNightlyRate: Number(rate),
          adults: Number(adults),
          children: Number(children),
          checkInNow: source === "walk_in" && checkInNow,
          idempotencyKey: key,
        });
        if (!result.ok) setError(result.error);
        else {
          notify(checkInNow && source === "walk_in" ? "Walk-in checked in." : "Reservation saved.");
          navigate(`/bookings?focus=${result.data.id}`);
        }
      }}>
        <div className="segmented" role="group" aria-label="Booking type">
          <button type="button" aria-pressed={source === "walk_in"} onClick={() => { setSource("walk_in"); setCheckIn(today); setCheckInNow(true); }}>Walk-in</button>
          <button type="button" aria-pressed={source === "advance"} onClick={() => { setSource("advance"); setCheckInNow(false); }}>Advance</button>
        </div>
        <Field label="Check-in"><TextInput type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} required /></Field>
        <Field label="Check-out"><TextInput type="date" value={checkOut} min={checkIn} onChange={(event) => setCheckOut(event.target.value)} required /></Field>
        <div className="segmented" role="group" aria-label="Guest">
          <button type="button" aria-pressed={guestMode === "existing"} onClick={() => setGuestMode("existing")} disabled={db.guests.length === 0}>Existing guest</button>
          <button type="button" aria-pressed={guestMode === "new"} onClick={() => setGuestMode("new")}>New guest</button>
        </div>
        {guestMode === "existing" ? (
          <Field label="Guest">
            <SelectInput value={guestId} onChange={(event) => setGuestId(event.target.value)}>
              {db.guests.map((guest) => <option key={guest.id} value={guest.id}>{guest.fullName}</option>)}
            </SelectInput>
          </Field>
        ) : (
          <>
            <Field label="Full name"><TextInput value={fullName} onChange={(event) => setFullName(event.target.value)} required /></Field>
            <Field label="Phone"><TextInput type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required /></Field>
            <Field label="Email"><TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
          </>
        )}
        <Field label="Room type">
          <SelectInput value={typeId} onChange={(event) => setTypeId(event.target.value)}>
            <option value="all">Any type</option>
            {db.roomTypes.filter((type) => type.active).map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
          </SelectInput>
        </Field>
        <fieldset className="choice-set">
          <legend>Available rooms</legend>
          {checkOut <= checkIn ? <p className="hint">Choose a check-out date to see free rooms.</p> : rooms.length === 0 ? <EmptyState title="No rooms free" body="Every active room is reserved, in house, or under maintenance for those dates." /> : (
            <div className="choice-grid">
              {rooms.map((room) => (
                <label key={room.id} className={`choice${roomId === room.id ? " selected" : ""}`}>
                  <input type="radio" name="room" value={room.id} checked={roomId === room.id} onChange={() => {
                    setRoomId(room.id);
                    if (!rateDirty) setRate(String(room.basePrice));
                  }} />
                  <strong>{room.roomNumber}</strong>
                  <span>{roomTypeName(db, room.roomTypeId)} · floor {room.floor}</span>
                  <Money amount={room.basePrice} />
                </label>
              ))}
            </div>
          )}
        </fieldset>
        <Field label="Agreed nightly rate" hint="Saved on this reservation only.">
          <TextInput inputMode="decimal" value={rate} onChange={(event) => { setRateDirty(true); setRate(event.target.value); }} required />
        </Field>
        <Field label="Adults"><TextInput inputMode="numeric" value={adults} onChange={(event) => setAdults(event.target.value)} required /></Field>
        <Field label="Children"><TextInput inputMode="numeric" value={children} onChange={(event) => setChildren(event.target.value)} required /></Field>
        {source === "walk_in" ? (
          <label className="check-row"><input type="checkbox" checked={checkInNow} onChange={(event) => setCheckInNow(event.target.checked)} /> Check in now</label>
        ) : null}
        {preview ? (
          <div className="detail-card">
            <p>{preview.nights} nights · room <Money amount={preview.roomCharge} /> · tax <Money amount={preview.taxAmount} /></p>
            <strong>Estimated total <Money amount={preview.total} /></strong>
          </div>
        ) : null}
        {error ? <ErrorNote message={error} /> : null}
        <div className="sticky-actions">
          <Button type="submit">Save reservation</Button>
          <Button type="button" variant="secondary" onClick={() => navigate("/bookings")}>Back</Button>
        </div>
      </form>
    </div>
  );
}
