import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useHotel } from "../state/HotelProvider";
import { Button, ErrorNote, Field, TextInput } from "../components/ui";

export function LoginPage() {
  const { actor, db, mode, signIn } = useHotel();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (actor) return <Navigate to={from} replace />;

  return (
    <div className="login-screen">
      <section className="login-aside">
        <p className="eyebrow">Hotel desk</p>
        <h1>{db.hotel.name}</h1>
        <p>Reservations, rooms, and money for the hotel you configure. Nothing on the desk is a fixed room count.</p>
      </section>
      <form
        className="login-card"
        onSubmit={(event) => {
          event.preventDefault();
          const message = signIn(email, password);
          setError(message ?? "");
        }}
      >
        <h2>Sign in</h2>
        <Field label="Email" error={error && !email ? "Email is required." : undefined}>
          <TextInput type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </Field>
        <Field label="Password">
          <TextInput type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </Field>
        {error ? <ErrorNote message={error} /> : null}
        <Button type="submit">Sign in</Button>
        {mode === "demo" ? (
          <div className="demo-accounts">
            <p>Demo accounts on this device</p>
            <ul>
              {db.users.filter((user) => user.active).map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(user.email);
                      setPassword(user.password);
                    }}
                  >
                    <strong>{user.name}</strong>
                    <span>{user.role === "owner" ? "Owner" : "Receptionist"} · {user.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="hint">Sign-in will work after the hotel API is connected.</p>
        )}
      </form>
    </div>
  );
}
