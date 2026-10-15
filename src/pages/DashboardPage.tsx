import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Banknote, BedDouble, CalendarCheck, CircleAlert, CircleCheck, DoorOpen, FileText, LogIn, LogOut, Undo2, Wallet, Wrench, type LucideIcon } from "lucide-react";
import { addDays } from "../domain/dates";
import { dashboardMetrics, type TrendPoint } from "../domain/metrics";
import { bookingMatchesQuery, bookingStatusLabel, guestName, roomNumber, roomTypeName } from "../domain/lookup";
import { nextArrivalOn, roomOperationalStatus } from "../domain/availability";
import { bookingLedger } from "../domain/billing";
import { useHotel } from "../state/HotelProvider";
import { Button, EmptyState, Money, PageHeader, Pagination, SearchField, SelectInput, StatusBadge } from "../components/ui";

const PAGE_SIZE = 12;

type Period = "today" | "week" | "month" | "custom";
type ActivityTab = "arrivals" | "departures" | "stays" | "recent" | "pending";

export function DashboardPage() {
  const { db, today, can } = useHotel();
  const [period, setPeriod] = useState<Period>("today");
  const [from, setFrom] = useState(addDays(today, -6));
  const [to, setTo] = useState(today);
  const range = period === "today" ? { from: today, to: today } : period === "week" ? { from: addDays(today, -6), to: today } : period === "month" ? { from: addDays(today, -29), to: today } : { from, to: to >= from ? to : from };
  const metrics = useMemo(() => dashboardMetrics(db, today, range.from, range.to), [db, today, range.from, range.to]);
  const ignored = db.payments.filter((payment) => payment.paidOn >= range.from && payment.paidOn <= range.to && payment.status !== "successful").reduce((sum, payment) => sum + payment.amount, 0);

  const actions = [
    { label: "New booking", to: "/bookings/new", show: can("bookings.manage") },
    { label: "Walk-in", to: "/bookings/new?source=walk_in", show: can("bookings.manage") },
    { label: "Advance booking", to: "/bookings/new?source=advance", show: can("bookings.manage") },
    { label: "Check-in", to: "/frontdesk?tab=arrivals", show: can("frontdesk.operate") },
    { label: "Check-out", to: "/frontdesk?tab=departures", show: can("frontdesk.operate") },
    { label: "Record payment", to: "/payments?new=1", show: can("payments.record") },
    { label: "Add room", to: "/rooms?new=1", show: can("rooms.manage") },
  ].filter((action) => action.show);

  return (
    <div className="page">
      <PageHeader title="Overview" lede="Every figure is counted from the current rooms, stays, and payments." />
      <section className="kpi-grid" aria-label="Today at a glance">
        <Kpi label="Active rooms" value={metrics.rooms.active} icon={DoorOpen} tone="neutral" />
        <Kpi label="Occupied" value={metrics.rooms.occupied} icon={BedDouble} tone="success" />
        <Kpi label="Available" value={metrics.rooms.available} icon={CircleCheck} tone="success" />
        <Kpi label="Reserved" value={metrics.rooms.reserved} icon={CalendarCheck} tone="info" />
        <Kpi label="Maintenance" value={metrics.rooms.maintenance} icon={Wrench} tone="danger" />
        <Kpi label="Arrivals today" value={metrics.arrivals} icon={LogIn} tone="info" />
        <Kpi label="Departures today" value={metrics.departures} icon={LogOut} tone="warning" />
        <Kpi label="Collected today" value={<Money amount={dashboardMetrics(db, today, today, today).financials.collections} />} icon={Banknote} tone="success" />
        <Kpi label="Outstanding" value={<Money amount={metrics.financials.outstanding} />} icon={CircleAlert} tone="warning" />
      </section>
      <div className="dash-grid">
        <RoomOverview />
        <aside className="stack">
          <section className="panel">
            <header className="panel-head"><h2>Quick actions</h2></header>
            <div className="action-grid">
              {actions.map((action) => (
                <Link key={action.label} className="action-link" to={action.to}>{action.label}</Link>
              ))}
            </div>
          </section>
          <ActivityPanel />
        </aside>
      </div>
      <section className="panel">
        <header className="panel-head">
          <div>
            <h2>Financial summary</h2>
            <p className="lede">Collections are successful payments only. Advances, refunds, and outstanding balances are separate.</p>
          </div>
          <div className="period-controls">
            <SelectInput aria-label="Date range" value={period} onChange={(event) => setPeriod(event.target.value as Period)}>
              <option value="today">Today</option>
              <option value="week">Last 7 days</option>
              <option value="month">Last 30 days</option>
              <option value="custom">Custom</option>
            </SelectInput>
            {period === "custom" ? (
              <>
                <input className="input" type="date" aria-label="From" value={from} onChange={(event) => setFrom(event.target.value)} />
                <input className="input" type="date" aria-label="To" value={to} onChange={(event) => setTo(event.target.value)} />
              </>
            ) : null}
          </div>
        </header>
        <div className="finance-grid">
          <Kpi label="Collections" value={<Money amount={metrics.financials.collections} />} icon={Banknote} tone="success" />
          <Kpi label="Invoiced" value={<Money amount={metrics.financials.invoiced} />} icon={FileText} tone="info" />
          <Kpi label="Advances" value={<Money amount={metrics.financials.advances} />} icon={Wallet} tone="neutral" />
          <Kpi label="Refunds" value={<Money amount={metrics.financials.refunds} />} icon={Undo2} tone="danger" />
          <Kpi label="Outstanding now" value={<Money amount={metrics.financials.outstanding} />} icon={CircleAlert} tone="warning" />
        </div>
        {ignored > 0 ? <p className="hint">Pending and failed transactions in this range total <Money amount={ignored} /> and are excluded from collections.</p> : null}
        <TrendBars points={metrics.trend} />
      </section>
    </div>
  );
}

function Kpi({ label, value, icon: Glyph, tone = "neutral" }: { label: string; value: ReactNode; icon: LucideIcon; tone?: "neutral" | "success" | "info" | "warning" | "danger" }) {
  return (
    <article className={`kpi kpi-${tone}`}>
      <div className="kpi-top">
        <p>{label}</p>
        <span className="kpi-icon"><Glyph aria-hidden size={14} strokeWidth={1.75} /></span>
      </div>
      <strong>{value}</strong>
    </article>
  );
}

function RoomOverview() {
  const { db, today, can } = useHotel();
  const [query, setQuery] = useState("");
  const [typeId, setTypeId] = useState("all");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const active = db.rooms.filter((room) => room.inventoryStatus === "active");
  const filtered = active
    .filter((room) => room.roomNumber.toLowerCase().includes(query.trim().toLowerCase()))
    .filter((room) => typeId === "all" || room.roomTypeId === typeId)
    .filter((room) => status === "all" || roomOperationalStatus(db, room, today) === status)
    .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const selected = db.rooms.find((room) => room.id === selectedId) ?? null;

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Rooms</h2>
        <div className="segmented" role="group" aria-label="Room layout">
          <button type="button" aria-pressed={view === "grid"} onClick={() => setView("grid")}>Grid</button>
          <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>List</button>
        </div>
      </header>
      <div className="toolbar">
        <SearchField value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Search room number" />
        <SelectInput aria-label="Room type" value={typeId} onChange={(event) => { setTypeId(event.target.value); setPage(1); }}>
          <option value="all">All types</option>
          {db.roomTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
        </SelectInput>
        <SelectInput aria-label="Room status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          <option value="all">All statuses</option>
          <option value="available">Available</option>
          <option value="occupied">Occupied</option>
          <option value="reserved">Reserved</option>
          <option value="maintenance">Maintenance</option>
        </SelectInput>
      </div>
      {filtered.length === 0 ? (
        <EmptyState title="No rooms match" body={active.length === 0 ? "Add a room and it will show up here and in the counts above." : "Try another room number, type, or status."} />
      ) : (
        <div className={view === "grid" ? "room-grid" : "room-list"}>
          {visible.map((room) => {
            const operational = roomOperationalStatus(db, room, today);
            return (
              <button type="button" key={room.id} className={`room-card status-${operational}`} onClick={() => setSelectedId(room.id)}>
                <strong>{room.roomNumber}</strong>
                <span>{roomTypeName(db, room.roomTypeId)}</span>
                <StatusBadge status={operational} />
              </button>
            );
          })}
        </div>
      )}
      <Pagination page={safePage} pages={pages} total={filtered.length} onPage={setPage} />
      {selected ? (
        <RoomDetails roomId={selected.id} onClose={() => setSelectedId(null)} canViewGuest={can("guests.viewPii")} />
      ) : null}
    </section>
  );
}

function RoomDetails({ roomId, onClose, canViewGuest }: { roomId: string; onClose: () => void; canViewGuest: boolean }) {
  const { db, today } = useHotel();
  const navigate = useNavigate();
  const room = db.rooms.find((item) => item.id === roomId);
  if (!room) return null;
  const status = roomOperationalStatus(db, room, today);
  const stay = db.bookings.find((booking) => booking.roomId === room.id && booking.status === "checked_in" && booking.checkIn <= today)
    ?? db.bookings.find((booking) => booking.roomId === room.id && booking.status === "confirmed" && booking.checkIn <= today && today < booking.checkOut);
  const arrival = nextArrivalOn(db, room.id, today);
  return (
    <div className="detail-card">
      <header className="panel-head">
        <h3>Room {room.roomNumber}</h3>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
      </header>
      <StatusBadge status={status} />
      <dl className="facts">
        <div><dt>Type</dt><dd>{roomTypeName(db, room.roomTypeId)}</dd></div>
        <div><dt>Floor</dt><dd>{room.floor}</dd></div>
        <div><dt>Capacity</dt><dd>{room.capacity}</dd></div>
        <div><dt>Base price</dt><dd><Money amount={room.basePrice} /></dd></div>
      </dl>
      {room.amenities.length > 0 ? <p className="hint">{room.amenities.join(" · ")}</p> : null}
      {room.maintenance && status === "occupied" ? <p className="hint">Maintenance is flagged, and a guest is still checked in.</p> : null}
      {arrival && status === "occupied" ? <p className="hint">Another arrival is also due today after checkout.</p> : null}
      {stay && canViewGuest ? (
        <div className="guest-block">
          <strong>{guestName(db, stay.guestId)}</strong>
          <p>{bookingStatusLabel(stay.status)} · <Money amount={stay.agreedNightlyRate} /> / night</p>
          <Button type="button" variant="secondary" onClick={() => navigate(`/bookings?focus=${stay.id}`)}>Open stay</Button>
        </div>
      ) : null}
      {stay && !canViewGuest ? <p className="hint">Guest details are hidden for this role.</p> : null}
    </div>
  );
}

function ActivityPanel() {
  const { db, today } = useHotel();
  const [tab, setTab] = useState<ActivityTab>("arrivals");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("date");
  const rows = useMemo(() => {
    if (tab === "pending") {
      return db.payments
        .filter((payment) => payment.status === "pending")
        .filter((payment) => `${guestName(db, payment.guestId)} ${roomNumber(db, db.bookings.find((booking) => booking.id === payment.bookingId)?.roomId ?? "")}`.toLowerCase().includes(query.trim().toLowerCase()))
        .sort((a, b) => sort === "amount" ? b.amount - a.amount : a.paidOn.localeCompare(b.paidOn));
    }
    let bookings = db.bookings.filter((booking) => bookingMatchesQuery(db, booking, query));
    if (tab === "arrivals") bookings = bookings.filter((booking) => booking.status === "confirmed" && booking.checkIn >= today);
    if (tab === "departures") bookings = bookings.filter((booking) => booking.status === "checked_in");
    if (tab === "stays") bookings = bookings.filter((booking) => booking.status === "checked_in");
    bookings.sort((a, b) => {
      if (sort === "guest") return guestName(db, a.guestId).localeCompare(guestName(db, b.guestId));
      if (sort === "room") return roomNumber(db, a.roomId).localeCompare(roomNumber(db, b.roomId), undefined, { numeric: true });
      const left = tab === "departures" || tab === "stays" ? a.checkOut : a.checkIn;
      const right = tab === "departures" || tab === "stays" ? b.checkOut : b.checkIn;
      return tab === "recent" ? b.createdOn.localeCompare(a.createdOn) : left.localeCompare(right);
    });
    return bookings;
  }, [db, query, sort, tab, today]);

  return (
    <section className="panel">
      <header className="panel-head"><h2>Today’s activity</h2></header>
      <div className="tabs" role="tablist">
        {([
          ["arrivals", "Arrivals"],
          ["departures", "Departures"],
          ["stays", "Stays"],
          ["recent", "Recent"],
          ["pending", "Pending pay"],
        ] as const).map(([id, label]) => (
          <button type="button" key={id} role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      <div className="toolbar">
        <SearchField value={query} onChange={setQuery} placeholder="Search guest or room" />
        <SelectInput aria-label="Sort" value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="date">Date</option>
          <option value="guest">Guest</option>
          <option value="room">Room</option>
          {tab === "pending" ? <option value="amount">Amount</option> : null}
        </SelectInput>
      </div>
      {rows.length === 0 ? <EmptyState title="Nothing in this list" body="New bookings and payments will appear here." /> : (
        <ul className="plain-list">
          {rows.slice(0, 8).map((row) => "kind" in row ? (
            <li key={row.id}>
              <Link to={`/payments?focus=${row.id}`}>
                <strong>{guestName(db, row.guestId)}</strong>
                <span>{row.kind} · <Money amount={row.amount} /> · {row.status}</span>
              </Link>
            </li>
          ) : (
            <li key={row.id}>
              <Link to={`/bookings?focus=${row.id}`}>
                <strong>{guestName(db, row.guestId)} · {roomNumber(db, row.roomId)}</strong>
                <span>{bookingStatusLabel(row.status)} · {row.checkIn} to {row.checkOut} · balance <Money amount={bookingLedger(db, row.id).outstanding} /></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link className="text-link" to={tab === "pending" ? "/payments?status=pending" : "/bookings"}>View full list</Link>
    </section>
  );
}

function TrendBars({ points }: { points: TrendPoint[] }) {
  const max = Math.max(1, ...points.map((point) => point.active));
  if (points.length === 0) return null;
  return (
    <div className="chart-scroll" aria-label="Occupancy trend">
      <div className="bars">
        {points.map((point) => (
          <div key={point.date} className="bar-col">
            <div className="bar" style={{ height: `${Math.max(4, (point.occupied / max) * 100)}%` }} title={`${point.occupied} occupied of ${point.active}`} />
            <span>{point.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
