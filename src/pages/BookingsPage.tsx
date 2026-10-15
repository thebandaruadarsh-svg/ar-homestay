import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { formatShortDate } from "../domain/dates";
import { countRooms } from "../domain/metrics";
import { bookingLedger, stayNights } from "../domain/billing";
import { bookingMatchesQuery, bookingStatusLabel, guestName, roomNumber, roomTypeName } from "../domain/lookup";
import type { Booking, BookingStatus } from "../domain/types";
import { useHotel } from "../state/HotelProvider";
import { Button, EmptyState, ErrorNote, Modal, Money, PageHeader, SearchField, SelectInput } from "../components/ui";

export function BookingsPage() {
  const { db, today, can, cancelBooking, markNoShow, notify } = useHotel();
  const [params] = useSearchParams();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<BookingStatus | "all">("all");
  const [source, setSource] = useState("all");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const focus = params.get("focus");
  const [openId, setOpenId] = useState<string | null>(focus);
  const bookings = useMemo(() => {
    return db.bookings
      .filter((booking) => status === "all" || booking.status === status)
      .filter((booking) => source === "all" || booking.source === source)
      .filter((booking) => bookingMatchesQuery(db, booking, query))
      .sort((a, b) => b.createdOn.localeCompare(a.createdOn) || b.checkIn.localeCompare(a.checkIn));
  }, [db, query, source, status]);
  const selected = db.bookings.find((booking) => booking.id === openId) ?? null;

  return (
    <div className="page">
      <PageHeader title="Bookings" lede="Availability is checked against stay dates and maintenance, not a stored Available flag.">
        {can("bookings.manage") ? <Link className="btn btn-primary" to="/bookings/new">New booking</Link> : null}
      </PageHeader>
      <MonthBoard month={month} onMonth={setMonth} />
      <section className="panel">
        <div className="toolbar">
          <SearchField value={query} onChange={setQuery} placeholder="Search guest or room" />
          <SelectInput aria-label="Booking status" value={status} onChange={(event) => setStatus(event.target.value as BookingStatus | "all")}>
            <option value="all">All statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="checked_in">Checked in</option>
            <option value="checked_out">Checked out</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No-show</option>
          </SelectInput>
          <SelectInput aria-label="Source" value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="all">Walk-in and advance</option>
            <option value="walk_in">Walk-in</option>
            <option value="advance">Advance</option>
          </SelectInput>
        </div>
        {bookings.length === 0 ? <EmptyState title="No bookings" body="Create a walk-in or an advance reservation and it will show up here." /> : (
          <div className="record-list">
            {bookings.map((booking) => (
              <button type="button" key={booking.id} className={`record as-button${booking.id === focus ? " focused" : ""}`} onClick={() => { setOpenId(booking.id); setError(""); setReason(""); }}>
                <div><span className="stack-label">Guest</span><strong>{guestName(db, booking.guestId)}</strong></div>
                <div><span className="stack-label">Room</span>{roomNumber(db, booking.roomId)} · {roomTypeName(db, booking.roomTypeId)}</div>
                <div><span className="stack-label">Dates</span>{formatShortDate(booking.checkIn)} – {formatShortDate(booking.checkOut)}</div>
                <div><span className="stack-label">Rate</span><Money amount={booking.agreedNightlyRate} /></div>
                <div><span className="stack-label">Status</span>{bookingStatusLabel(booking.status)}</div>
              </button>
            ))}
          </div>
        )}
      </section>
      <Modal open={Boolean(selected)} title={selected ? guestName(db, selected.guestId) : "Booking"} onClose={() => setOpenId(null)}>
        {selected ? <BookingDetail booking={selected} reason={reason} setReason={setReason} error={error} onCancel={() => {
          const result = cancelBooking(selected.id, reason);
          if (!result.ok) setError(result.error);
          else { notify("Reservation cancelled. Payment history was kept."); setOpenId(null); }
        }} onNoShow={() => {
          const result = markNoShow(selected.id);
          if (!result.ok) setError(result.error);
          else { notify("Marked as a no-show."); setOpenId(null); }
        }} /> : null}
      </Modal>
    </div>
  );
}

function BookingDetail({ booking, reason, setReason, error, onCancel, onNoShow }: { booking: Booking; reason: string; setReason: (value: string) => void; error: string; onCancel: () => void; onNoShow: () => void }) {
  const { db, can } = useHotel();
  const ledger = bookingLedger(db, booking.id);
  return (
    <div className="form-grid">
      <dl className="facts">
        <div><dt>Room</dt><dd>{roomNumber(db, booking.roomId)}</dd></div>
        <div><dt>Stay</dt><dd>{booking.checkIn} to {booking.checkOut} · {stayNights(booking)} nights</dd></div>
        <div><dt>Agreed rate</dt><dd><Money amount={booking.agreedNightlyRate} /> / night</dd></div>
        <div><dt>Status</dt><dd>{bookingStatusLabel(booking.status)} · {booking.source === "walk_in" ? "Walk-in" : "Advance"}</dd></div>
        <div><dt>Outstanding</dt><dd><Money amount={ledger.outstanding} /></dd></div>
      </dl>
      {booking.status === "confirmed" && can("bookings.manage") ? (
        <>
          <label className="field"><span>Cancellation reason</span><input className="input" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
          <div className="row-actions">
            <Button type="button" variant="danger" onClick={onCancel}>Cancel reservation</Button>
            <Button type="button" variant="secondary" onClick={onNoShow}>Mark no-show</Button>
            <Link className="btn btn-primary" to={`/frontdesk?tab=arrivals&focus=${booking.id}`}>Check in</Link>
          </div>
        </>
      ) : null}
      {booking.status === "checked_in" && can("frontdesk.operate") ? <Link className="btn btn-primary" to={`/frontdesk?tab=departures&focus=${booking.id}`}>Check out</Link> : null}
      {can("payments.record") ? <Link className="btn btn-secondary" to={`/payments?new=1&booking=${booking.id}`}>Record payment</Link> : null}
      {error ? <ErrorNote message={error} /> : null}
    </div>
  );
}

function MonthBoard({ month, onMonth }: { month: string; onMonth: (month: string) => void }) {
  const { db } = useHotel();
  const [year, monthNumber] = month.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const lead = (firstWeekday + 6) % 7;
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, index) => index + 1)];
  return (
    <section className="panel calendar-panel">
      <header className="panel-head">
        <h2>{new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, monthNumber - 1, 1)))}</h2>
        <div className="row-actions">
          <Button type="button" variant="secondary" onClick={() => onMonth(shiftMonth(month, -1))}>Previous</Button>
          <Button type="button" variant="secondary" onClick={() => onMonth(shiftMonth(month, 1))}>Next</Button>
        </div>
      </header>
      <div className="calendar">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => <span key={label} className="cal-label">{label}</span>)}
        {cells.map((day, index) => {
          if (!day) return <span key={`empty-${index}`} className="cal-cell empty" />;
          const date = `${month}-${String(day).padStart(2, "0")}`;
          const counts = countRooms(db, date);
          const ratio = counts.active ? counts.occupied / counts.active : 0;
          return (
            <div key={date} className="cal-cell" title={`${counts.occupied} occupied of ${counts.active}`}>
              <strong>{day}</strong>
              <span>{counts.active ? `${counts.occupied}/${counts.active}` : "—"}</span>
              <i style={{ width: `${ratio * 100}%` }} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}
