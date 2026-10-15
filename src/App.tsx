import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import type { Action } from "./domain/permissions";
import { useHotel } from "./state/HotelProvider";
import { Shell } from "./components/Shell";
import { EmptyState } from "./components/ui";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { RoomsPage } from "./pages/RoomsPage";
import { BookingsPage } from "./pages/BookingsPage";
import { BookingFormPage } from "./pages/BookingFormPage";
import { GuestsPage } from "./pages/GuestsPage";
import { FrontDeskPage } from "./pages/FrontDeskPage";
import { InvoicesPage } from "./pages/InvoicesPage";
import { PaymentsPage } from "./pages/PaymentsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { UsersPage } from "./pages/UsersPage";
import { SettingsPage } from "./pages/SettingsPage";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Shell />}>
          <Route index element={<DashboardPage />} />
          <Route path="rooms" element={<RoomsPage />} />
          <Route path="bookings" element={<BookingsPage />} />
          <Route path="bookings/new" element={<BookingFormPage />} />
          <Route path="guests" element={<GuestsPage />} />
          <Route path="frontdesk" element={<FrontDeskPage />} />
          <Route path="invoices" element={<InvoicesPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route element={<Require action="reports.view" />}>
            <Route path="reports" element={<ReportsPage />} />
          </Route>
          <Route element={<Require action="users.manage" />}>
            <Route path="users" element={<UsersPage />} />
          </Route>
          <Route element={<Require action="settings.manage" />}>
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}

function RequireAuth() {
  const { actor } = useHotel();
  const location = useLocation();
  if (!actor) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

function Require({ action }: { action: Action }) {
  const { can } = useHotel();
  if (!can(action)) {
    return (
      <EmptyState
        title="This section is restricted"
        body="Your role can use the front desk, but this part of StayFlow is limited to another role. The server will enforce the same rule when the API is connected."
      />
    );
  }
  return <Outlet />;
}
