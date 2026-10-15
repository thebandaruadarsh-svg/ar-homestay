import { useState } from "react";
import { guestName, roomNumber } from "../domain/lookup";
import { invoiceTax, invoiceTotal, invoiceSubtotal } from "../domain/billing";
import type { Invoice } from "../domain/types";
import { useHotel } from "../state/HotelProvider";
import { Button, EmptyState, ErrorNote, Field, Modal, Money, PageHeader, SearchField, TextInput } from "../components/ui";

export function InvoicesPage() {
  const { db, can } = useHotel();
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const invoices = db.invoices.filter((invoice) => {
    const booking = db.bookings.find((item) => item.id === invoice.bookingId);
    const haystack = `${guestName(db, invoice.guestId)} ${booking ? roomNumber(db, booking.roomId) : ""} ${invoice.status}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });
  const selected = db.invoices.find((invoice) => invoice.id === openId) ?? null;
  return (
    <div className="page">
      <PageHeader title="Invoices" lede="Issued totals keep the tax rate from the day they were created." />
      <section className="panel">
        <SearchField value={query} onChange={setQuery} placeholder="Search guest or room" />
        {invoices.length === 0 ? <EmptyState title="No invoices" body="Check-out creates an invoice from the agreed rate. You can also open one from a stay." /> : (
          <div className="record-list">
            {invoices.map((invoice) => {
              const booking = db.bookings.find((item) => item.id === invoice.bookingId);
              return (
                <button type="button" key={invoice.id} className="record as-button" onClick={() => setOpenId(invoice.id)}>
                  <div><span className="stack-label">Guest</span><strong>{guestName(db, invoice.guestId)}</strong></div>
                  <div><span className="stack-label">Room</span>{booking ? roomNumber(db, booking.roomId) : "—"}</div>
                  <div><span className="stack-label">Issued</span>{invoice.issuedOn}</div>
                  <div><span className="stack-label">Total</span><Money amount={invoiceTotal(invoice)} /></div>
                  <div><span className="stack-label">Status</span>{invoice.status === "issued" ? "Issued" : "Void"}</div>
                </button>
              );
            })}
          </div>
        )}
      </section>
      <Modal open={Boolean(selected)} title="Invoice" onClose={() => setOpenId(null)}>
        {selected ? <InvoiceDetail invoice={selected} canVoid={can("reports.financial")} /> : null}
      </Modal>
    </div>
  );
}

function InvoiceDetail({ invoice, canVoid }: { invoice: Invoice; canVoid: boolean }) {
  const { db, addInvoiceLine, voidInvoice, notify } = useHotel();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="form-grid">
      <p>{guestName(db, invoice.guestId)} · {invoice.issuedOn} · tax {invoice.taxPercent}%</p>
      <ul className="plain-list">
        {invoice.lines.map((line) => (
          <li key={line.id}><span>{line.description}</span><Money amount={line.amount} /></li>
        ))}
      </ul>
      <dl className="facts">
        <div><dt>Subtotal</dt><dd><Money amount={invoiceSubtotal(invoice)} /></dd></div>
        <div><dt>Tax</dt><dd><Money amount={invoiceTax(invoice)} /></dd></div>
        <div><dt>Total</dt><dd><Money amount={invoiceTotal(invoice)} /></dd></div>
      </dl>
      {invoice.status === "issued" ? (
        <form className="form-grid" onSubmit={(event) => {
          event.preventDefault();
          const result = addInvoiceLine(invoice.id, description, Number(amount));
          if (!result.ok) setError(result.error);
          else { setDescription(""); setAmount(""); setError(""); notify("Charge added."); }
        }}>
          <Field label="Extra charge"><TextInput value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
          <Field label="Amount"><TextInput inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></Field>
          <Button type="submit" variant="secondary">Add charge</Button>
        </form>
      ) : <p className="hint">This invoice is void. The record is still here.</p>}
      {canVoid && invoice.status === "issued" ? <Button type="button" variant="danger" onClick={() => { const result = voidInvoice(invoice.id); if (!result.ok) setError(result.error); else notify("Invoice voided."); }}>Void invoice</Button> : null}
      {error ? <ErrorNote message={error} /> : null}
    </div>
  );
}
