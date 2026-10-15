import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { bookingLedger } from "../domain/billing";
import { guestName, roomNumber } from "../domain/lookup";
import type { PaymentKind, PaymentMethod, PaymentStatus } from "../domain/types";
import { useHotel } from "../state/HotelProvider";
import { Button, EmptyState, ErrorNote, Field, Money, PageHeader, SearchField, SelectInput, TextInput } from "../components/ui";

export function PaymentsPage() {
  const { db, today, can, recordPayment, notify } = useHotel();
  const [params] = useSearchParams();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(params.get("status") ?? "all");
  const [showForm, setShowForm] = useState(params.get("new") === "1");
  const [bookingId, setBookingId] = useState(params.get("booking") ?? db.bookings[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [kind, setKind] = useState<PaymentKind>("collection");
  const [payStatus, setPayStatus] = useState<PaymentStatus>("successful");
  const [paidOn, setPaidOn] = useState(today);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [key, setKey] = useState(() => crypto.randomUUID());
  const focus = params.get("focus");
  const payments = db.payments
    .filter((payment) => status === "all" || payment.status === status)
    .filter((payment) => guestName(db, payment.guestId).toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => b.paidOn.localeCompare(a.paidOn));
  const booking = db.bookings.find((item) => item.id === bookingId);
  const ledger = booking ? bookingLedger(db, booking.id) : null;

  return (
    <div className="page">
      <PageHeader title="Payments" lede="Only successful payments count as money received. Pending and failed attempts stay on the record.">
        {can("payments.record") ? <Button type="button" onClick={() => setShowForm(true)}>Record payment</Button> : null}
      </PageHeader>
      {showForm && can("payments.record") ? (
        <form className="panel form-grid" onSubmit={(event) => {
          event.preventDefault();
          const result = recordPayment({ bookingId, amount: Number(amount), method, kind, status: payStatus, paidOn, note, idempotencyKey: key });
          if (!result.ok) setError(result.error);
          else {
            notify(payStatus === "successful" ? "Payment recorded." : "Payment saved. It is not included in collections.");
            setShowForm(false);
            setAmount("");
            setNote("");
            setKey(crypto.randomUUID());
            setError("");
          }
        }}>
          <Field label="Booking">
            <SelectInput value={bookingId} onChange={(event) => setBookingId(event.target.value)}>
              {db.bookings.map((item) => <option key={item.id} value={item.id}>{guestName(db, item.guestId)} · room {roomNumber(db, item.roomId)} · {item.checkIn}</option>)}
            </SelectInput>
          </Field>
          {ledger ? <p className="hint">Outstanding <Money amount={ledger.outstanding} /> · advances <Money amount={ledger.advances} /> · collections <Money amount={ledger.collections} /></p> : null}
          <Field label="Amount"><TextInput inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required /></Field>
          <Field label="Method">
            <SelectInput value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="upi">UPI</option>
              <option value="bank">Bank transfer</option>
            </SelectInput>
          </Field>
          <Field label="Kind">
            <SelectInput value={kind} onChange={(event) => setKind(event.target.value as PaymentKind)}>
              <option value="collection">Collection</option>
              <option value="advance">Advance</option>
              {can("payments.refund") ? <option value="refund">Refund</option> : null}
            </SelectInput>
          </Field>
          <Field label="Status" hint="Pending and failed payments are excluded from collections.">
            <SelectInput value={payStatus} onChange={(event) => setPayStatus(event.target.value as PaymentStatus)}>
              <option value="successful">Successful</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </SelectInput>
          </Field>
          <Field label="Date"><TextInput type="date" value={paidOn} onChange={(event) => setPaidOn(event.target.value)} required /></Field>
          <Field label="Note"><TextInput value={note} onChange={(event) => setNote(event.target.value)} /></Field>
          {error ? <ErrorNote message={error} /> : null}
          <div className="sticky-actions">
            <Button type="submit">Save payment</Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Close</Button>
          </div>
        </form>
      ) : null}
      <section className="panel">
        <div className="toolbar">
          <SearchField value={query} onChange={setQuery} placeholder="Search guest" />
          <SelectInput aria-label="Payment status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="successful">Successful</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </SelectInput>
        </div>
        {payments.length === 0 ? <EmptyState title="No payments" body="Record a collection, advance, or refund against a booking." /> : (
          <div className="record-list">
            {payments.map((payment) => (
              <article key={payment.id} className={`record${payment.id === focus ? " focused" : ""}`} style={{ ["--cols" as string]: "1.3fr 0.8fr 0.8fr 0.8fr 0.7fr" }}>
                <div><span className="stack-label">Guest</span><strong>{guestName(db, payment.guestId)}</strong></div>
                <div><span className="stack-label">Kind</span>{payment.kind}</div>
                <div><span className="stack-label">Amount</span><Money amount={payment.amount} /></div>
                <div><span className="stack-label">Status</span>{payment.status}</div>
                <div><span className="stack-label">Date</span>{payment.paidOn}</div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
