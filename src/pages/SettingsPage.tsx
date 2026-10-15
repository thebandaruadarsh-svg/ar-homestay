import { useState } from "react";
import { useHotel } from "../state/HotelProvider";
import { Button, ErrorNote, Field, PageHeader, SearchField, TextInput } from "../components/ui";

export function SettingsPage() {
  const { db, mode, updateHotel, resetDemo, notify } = useHotel();
  const [name, setName] = useState(db.hotel.name);
  const [logoUrl, setLogoUrl] = useState(db.hotel.logoUrl);
  const [currency, setCurrency] = useState(db.hotel.currency);
  const [timeZone, setTimeZone] = useState(db.hotel.timeZone);
  const [taxPercent, setTaxPercent] = useState(String(db.hotel.taxPercent));
  const [checkInTime, setCheckInTime] = useState(db.hotel.checkInTime);
  const [checkOutTime, setCheckOutTime] = useState(db.hotel.checkOutTime);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const logs = db.auditLogs.filter((log) => `${log.summary} ${log.actorName} ${log.action}`.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="page">
      <PageHeader title="Hotel settings" lede="Name, currency, tax, and timezone apply to new charges. Issued invoices keep the tax they were created with." />
      <form className="panel form-grid" onSubmit={(event) => {
        event.preventDefault();
        const result = updateHotel({ name, logoUrl, currency, timeZone, taxPercent: Number(taxPercent), checkInTime, checkOutTime });
        if (!result.ok) setError(result.error);
        else { setError(""); notify("Hotel settings saved."); }
      }}>
        <Field label="Hotel name"><TextInput value={name} onChange={(event) => setName(event.target.value)} required /></Field>
        <Field label="Logo URL"><TextInput value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} placeholder="https://" /></Field>
        <Field label="Currency"><TextInput value={currency} maxLength={3} onChange={(event) => setCurrency(event.target.value.toUpperCase())} required /></Field>
        <Field label="Timezone"><TextInput value={timeZone} onChange={(event) => setTimeZone(event.target.value)} required /></Field>
        <Field label="Tax percent" hint="Stored on each new invoice. Older invoices do not change."><TextInput inputMode="decimal" value={taxPercent} onChange={(event) => setTaxPercent(event.target.value)} required /></Field>
        <Field label="Check-in time"><TextInput type="time" value={checkInTime} onChange={(event) => setCheckInTime(event.target.value)} /></Field>
        <Field label="Check-out time"><TextInput type="time" value={checkOutTime} onChange={(event) => setCheckOutTime(event.target.value)} /></Field>
        {error ? <ErrorNote message={error} /> : null}
        <div className="sticky-actions">
          <Button type="submit">Save settings</Button>
          {mode === "demo" ? <Button type="button" variant="secondary" onClick={() => { const result = resetDemo(); if (!result.ok) setError(result.error); else notify("Demo hotel restored."); }}>Restore demo data</Button> : null}
        </div>
      </form>
      <section className="panel">
        <header className="panel-head"><h2>Audit history</h2></header>
        <SearchField value={query} onChange={setQuery} placeholder="Search the audit log" />
        <ul className="plain-list">
          {logs.slice(0, 40).map((log) => (
            <li key={log.id}>
              <strong>{log.summary}</strong>
              <span>{log.actorName} · {log.action} · {log.at.slice(0, 16).replace("T", " ")}</span>
            </li>
          ))}
        </ul>
        {logs.length === 0 ? <p>No audit entries match.</p> : null}
      </section>
    </div>
  );
}
