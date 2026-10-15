import { useState } from "react";
import { Link } from "react-router-dom";
import { guestLedger } from "../domain/billing";
import type { Guest } from "../domain/types";
import { useHotel } from "../state/HotelProvider";
import { Button, EmptyState, ErrorNote, Field, Modal, Money, PageHeader, SearchField, TextInput } from "../components/ui";

export function GuestsPage() {
  const { db } = useHotel();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Guest | "new" | null>(null);
  const guests = db.guests
    .filter((guest) => `${guest.fullName} ${guest.phone} ${guest.email}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
  return (
    <div className="page">
      <PageHeader title="Guests" lede="Profiles stay on file after a stay ends.">
        <Button type="button" onClick={() => setEditing("new")}>Add guest</Button>
      </PageHeader>
      <section className="panel">
        <SearchField value={query} onChange={setQuery} placeholder="Search name, phone, or email" />
        {guests.length === 0 ? <EmptyState title="No guests" body="Add a guest here, or create one while making a booking." /> : (
          <div className="record-list">
            {guests.map((guest) => {
              const ledger = guestLedger(db, guest.id);
              const stays = db.bookings.filter((booking) => booking.guestId === guest.id).length;
              return (
                <article key={guest.id} className="record" style={{ ["--cols" as string]: "1.4fr 1fr 0.6fr 0.8fr auto" }}>
                  <div><span className="stack-label">Guest</span><strong>{guest.fullName}</strong><small className="hint">{guest.phone}</small></div>
                  <div><span className="stack-label">Email</span>{guest.email || "—"}</div>
                  <div><span className="stack-label">Stays</span>{stays}</div>
                  <div><span className="stack-label">Outstanding</span><Money amount={ledger.outstanding} /></div>
                  <Button type="button" variant="secondary" onClick={() => setEditing(guest)}>Edit</Button>
                </article>
              );
            })}
          </div>
        )}
      </section>
      {editing ? <GuestForm target={editing} onClose={() => setEditing(null)} /> : null}
      <p className="hint">Open a guest’s stay from <Link to="/bookings">Bookings</Link>.</p>
    </div>
  );
}

function GuestForm({ target, onClose }: { target: Guest | "new"; onClose: () => void }) {
  const existing = target === "new" ? null : target;
  const { saveGuest, notify } = useHotel();
  const [fullName, setFullName] = useState(existing?.fullName ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [idType, setIdType] = useState(existing?.idType ?? "");
  const [idNumber, setIdNumber] = useState(existing?.idNumber ?? "");
  const [error, setError] = useState("");
  return (
    <Modal open title={existing ? "Edit guest" : "Add guest"} onClose={onClose}>
      <form className="form-grid" onSubmit={(event) => {
        event.preventDefault();
        const result = saveGuest({ fullName, phone, email, idType, idNumber }, existing?.id);
        if (!result.ok) setError(result.error);
        else { notify("Guest saved."); onClose(); }
      }}>
        <Field label="Full name"><TextInput value={fullName} onChange={(event) => setFullName(event.target.value)} required /></Field>
        <Field label="Phone"><TextInput type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required /></Field>
        <Field label="Email"><TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
        <Field label="ID type"><TextInput value={idType} onChange={(event) => setIdType(event.target.value)} /></Field>
        <Field label="ID number"><TextInput value={idNumber} onChange={(event) => setIdNumber(event.target.value)} /></Field>
        {error ? <ErrorNote message={error} /> : null}
        <div className="sticky-actions">
          <Button type="submit">Save guest</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}
