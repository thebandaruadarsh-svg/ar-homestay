import { useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { buildAlerts } from "../domain/lookup";
import { formatLongDate, greetingForHour, hourInZone } from "../domain/dates";
import { useHotel } from "../state/HotelProvider";
import { Icon } from "./Icon";
import { Modal } from "./ui";

const NAV = [
  { to: "/", label: "Overview", icon: "grid", end: true, primary: true },
  { to: "/rooms", label: "Rooms", icon: "bed", end: false, primary: true, action: "rooms.view" },
  { to: "/bookings", label: "Bookings", icon: "calendar", end: false, primary: true, action: "bookings.manage" },
  { to: "/guests", label: "Guests", icon: "users", end: false, primary: false, action: "guests.manage" },
  { to: "/frontdesk", label: "Front desk", icon: "key", end: false, primary: true, action: "frontdesk.operate" },
  { to: "/invoices", label: "Invoices", icon: "file", end: false, primary: false, action: "invoices.manage" },
  { to: "/payments", label: "Payments", icon: "card", end: false, primary: false, action: "payments.record" },
  { to: "/reports", label: "Reports", icon: "chart", end: false, primary: false, action: "reports.view" },
  { to: "/users", label: "Users", icon: "shield", end: false, primary: false, action: "users.manage" },
  { to: "/settings", label: "Settings", icon: "settings", end: false, primary: false, action: "settings.manage" },
] as const;

export function Shell() {
  const { db, actor, today, can, signOut, mode, toast } = useHotel();
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();
  const alerts = useMemo(() => buildAlerts(db, today), [db, today]);
  const hour = hourInZone(db.hotel.timeZone);
  const visible = NAV.filter((item) => !("action" in item) || !item.action || can(item.action));
  const initials = actor?.name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase() ?? "";

  return (
    <div className="app-shell">
      <a className="skip" href="#main">Skip to content</a>
      <aside className="sidebar">
        <div className="brand">
          <BrandMark logoUrl={db.hotel.logoUrl} name={db.hotel.name} />
          <span className="nav-label brand-name">{db.hotel.name}</span>
        </div>
        <nav className="nav-list" aria-label="Primary">
          {visible.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
              <Icon name={item.icon} />
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <button type="button" className="nav-link signout" onClick={signOut}>
          <Icon name="logout" />
          <span className="nav-label">Sign out</span>
        </button>
      </aside>
      <div className="workspace">
        <div className={mode === "demo" ? "demo-banner" : "api-banner"}>
          {mode === "demo"
            ? "Demo mode. Rooms, rates, and totals on this screen come from the local demo hotel. Google Sheets is not connected yet."
            : "The hotel API is not connected. Counts stay at zero until live records are available."}
        </div>
        <header className="topbar">
          <div className="topbar-title">
            <BrandMark logoUrl={db.hotel.logoUrl} name={db.hotel.name} />
            <div>
              <strong>{db.hotel.name}</strong>
              <p>{greetingForHour(hour)}{actor ? `, ${actor.name.split(" ")[0]}` : ""} · {formatLongDate(today)}</p>
            </div>
          </div>
          <div className="topbar-actions">
            <button type="button" className="icon-btn bell" onClick={() => setAlertsOpen(true)} aria-label={`Notifications, ${alerts.length} open`}>
              <Icon name="bell" />
              {alerts.length > 0 ? <span className="count">{alerts.length}</span> : null}
            </button>
            <div className="user-chip">
              <span className="avatar" aria-hidden="true">{initials}</span>
              <span className="user-copy">
                <strong>{actor?.name}</strong>
                <small>{actor?.role === "owner" ? "Owner" : "Receptionist"}</small>
              </span>
            </div>
          </div>
        </header>
        <main id="main" className="app-main">
          <Outlet />
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Mobile">
        {visible.filter((item) => item.primary).map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `bottom-link${isActive ? " active" : ""}`}>
            <Icon name={item.icon} />
            <span>{item.label === "Front desk" ? "Desk" : item.label}</span>
          </NavLink>
        ))}
        <button type="button" className="bottom-link" onClick={() => setMoreOpen(true)}>
          <Icon name="grid" />
          <span>More</span>
        </button>
      </nav>
      {toast ? <div className="toast" role="status">{toast}</div> : null}
      <Modal open={alertsOpen} title="Notifications" onClose={() => setAlertsOpen(false)}>
        {alerts.length === 0 ? <p>Nothing needs attention right now.</p> : (
          <ul className="plain-list">
            {alerts.map((alert) => (
              <li key={alert.id}>
                <button type="button" className="link-row" onClick={() => { setAlertsOpen(false); navigate(alert.href); }}>
                  <strong>{alert.title}</strong>
                  <span>{alert.detail}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
      <Modal open={moreOpen} title="More" onClose={() => setMoreOpen(false)}>
        <div className="more-list">
          {visible.filter((item) => !item.primary).map((item) => (
            <NavLink key={item.to} to={item.to} className="more-link" onClick={() => setMoreOpen(false)}>
              <Icon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
          <button type="button" className="more-link" onClick={signOut}>
            <Icon name="logout" />
            Sign out
          </button>
        </div>
      </Modal>
    </div>
  );
}

function BrandMark({ logoUrl, name }: { logoUrl: string; name: string }) {
  if (logoUrl) return <img className="brand-mark" src={logoUrl} alt="" />;
  return <span className="brand-mark" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>;
}
