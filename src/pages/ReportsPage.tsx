import { useMemo, useState } from "react";
import { addDays } from "../domain/dates";
import { financialSummary, occupancyTrend, countRooms } from "../domain/metrics";
import { roomTypeName } from "../domain/lookup";
import { useHotel } from "../state/HotelProvider";
import { Money, PageHeader, SelectInput } from "../components/ui";

export function ReportsPage() {
  const { db, today, can } = useHotel();
  const [span, setSpan] = useState("30");
  const from = addDays(today, -(Number(span) - 1));
  const financials = useMemo(() => financialSummary(db, from, today), [db, from, today]);
  const trend = useMemo(() => occupancyTrend(db, from, today), [db, from, today]);
  const todayCounts = countRooms(db, today);
  const occupancy = todayCounts.active ? Math.round((todayCounts.occupied / todayCounts.active) * 100) : null;
  const byType = db.roomTypes.map((type) => {
    const nights = db.bookings
      .filter((booking) => booking.roomTypeId === type.id && booking.status !== "cancelled" && booking.status !== "no_show")
      .filter((booking) => booking.checkIn <= today && booking.checkOut > from)
      .length;
    return { id: type.id, name: type.name, stays: nights };
  });

  return (
    <div className="page">
      <PageHeader title="Reports" lede="Occupancy and money are calculated for the dates you pick.">
        <SelectInput aria-label="Report range" value={span} onChange={(event) => setSpan(event.target.value)}>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </SelectInput>
      </PageHeader>
      <section className="kpi-grid">
        <article className="kpi"><p>Active rooms</p><strong>{todayCounts.active}</strong></article>
        <article className="kpi"><p>Occupied tonight</p><strong>{todayCounts.occupied}</strong></article>
        <article className="kpi"><p>Occupancy</p><strong>{occupancy === null ? "—" : `${occupancy}%`}</strong></article>
      </section>
      {can("reports.financial") ? (
        <section className="finance-grid">
          <article className="kpi"><p>Collections</p><strong><Money amount={financials.collections} /></strong></article>
          <article className="kpi"><p>Invoiced</p><strong><Money amount={financials.invoiced} /></strong></article>
          <article className="kpi"><p>Advances</p><strong><Money amount={financials.advances} /></strong></article>
          <article className="kpi"><p>Refunds</p><strong><Money amount={financials.refunds} /></strong></article>
          <article className="kpi"><p>Outstanding now</p><strong><Money amount={financials.outstanding} /></strong></article>
        </section>
      ) : <p className="hint">Financial totals are limited to the owner. You can still record payments from the desk.</p>}
      <section className="panel">
        <h2>Stays touching this range, by room type</h2>
        {byType.length === 0 ? <p>No room types are configured.</p> : (
          <ul className="plain-list">
            {byType.map((type) => <li key={type.id}><span>{roomTypeName(db, type.id)}</span><strong>{type.stays}</strong></li>)}
          </ul>
        )}
      </section>
      <section className="panel">
        <h2>Occupied rooms</h2>
        <div className="chart-scroll">
          <div className="bars">
            {trend.map((point) => (
              <div key={point.date} className="bar-col">
                <div className="bar" style={{ height: `${point.active ? Math.max(4, (point.occupied / point.active) * 100) : 4}%` }} />
                <span>{point.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
