import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { bookingLedger, previewStayCharge } from "../domain/billing";
import { guestName, roomNumber } from "../domain/lookup";
import { useHotel } from "../state/HotelProvider";
import { Button, EmptyState, ErrorNote, Money, PageHeader, SearchField } from "../components/ui";

export function FrontDeskPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "departures" ? "departures" : "arrivals";
  const focus = params.get("focus");
  const { db, today, checkIn, checkOut, notify } = useHotel();
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const arrivals = db.bookings.filter((booking) => booking.status === "confirmed" && booking.checkIn <= today && today <= booking.checkOut);
  const departures = db.bookings.filter((booking) => booking.status === "checked_in");
  const rows = (tab === "arrivals" ? arrivals : departures).filter((booking) => `${guestName(db, booking.guestId)} ${roomNumber(db, booking.roomId)}`.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="page">
      <PageHeader title="Check-in and check-out" lede="These are explicit stay changes. A room is not occupied until check-in, and not free of the guest until check-out." />
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "arrivals"} className={tab === "arrivals" ? "active" : ""} onClick={() => setParams({ tab: "arrivals" })}>Arrivals ({arrivals.length})</button>
        <button type="button" role="tab" aria-selected={tab === "departures"} className={tab === "departures" ? "active" : ""} onClick={() => setParams({ tab: "departures" })}>In house ({departures.length})</button>
      </div>
      <section className="panel">
        <SearchField value={query} onChange={setQuery} placeholder="Search guest or room" />
        {error ? <ErrorNote message={error} /> : null}
        {rows.length === 0 ? <EmptyState title={tab === "arrivals" ? "No arrivals waiting" : "No guests in house"} body="Confirmed reservations that have reached their check-in date appear here." /> : (
          <div className="record-list">
            {rows.map((booking) => {
              const room = db.rooms.find((item) => item.id === booking.roomId);
              const preview = room ? previewStayCharge(booking, db.hotel.taxPercent, room.roomNumber) : null;
              const ledger = bookingLedger(db, booking.id);
              return (
                <article key={booking.id} className={`record${booking.id === focus ? " focused" : ""}`} style={{ ["--cols" as string]: "1.3fr 0.8fr 1fr auto" }}>
                  <div><span className="stack-label">Guest</span><strong>{guestName(db, booking.guestId)}</strong><small className="hint">Room {roomNumber(db, booking.roomId)}</small></div>
                  <div><span className="stack-label">Dates</span>{booking.checkIn} → {booking.checkOut}</div>
                  <div><span className="stack-label">{tab === "departures" ? "Balance" : "Agreed rate"}</span>{tab === "departures" ? <Money amount={ledger.outstanding} /> : <Money amount={booking.agreedNightlyRate} />}</div>
                  {tab === "arrivals" ? (
                    <Button type="button" onClick={() => { const result = checkIn(booking.id); if (!result.ok) setError(result.error); else { setError(""); notify(`${guestName(db, booking.guestId)} checked in.`); } }}>Check in</Button>
                  ) : (
                    <div className="row-actions">
                      {preview ? <span className="hint">Room charge <Money amount={preview.total} /></span> : null}
                      <Button type="button" onClick={() => { const result = checkOut(booking.id); if (!result.ok) setError(result.error); else { setError(""); notify("Checked out. An invoice was kept if one was issued."); } }}>Check out</Button>
                      <Link className="btn btn-secondary" to={`/payments?new=1&booking=${booking.id}`}>Payment</Link>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
