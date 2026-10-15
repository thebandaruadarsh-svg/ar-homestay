import { useState } from "react";
import type { Role, UserAccount } from "../domain/types";
import { useHotel } from "../state/HotelProvider";
import { Button, EmptyState, ErrorNote, Field, Modal, PageHeader, SelectInput, TextInput } from "../components/ui";

export function UsersPage() {
  const { db, deactivateUser, notify } = useHotel();
  const [editing, setEditing] = useState<UserAccount | "new" | null>(null);
  const [error, setError] = useState("");
  return (
    <div className="page">
      <PageHeader title="Users" lede="Owners configure the hotel. Receptionists run the desk. The same limits apply inside every save, not only in the menu.">
        <Button type="button" onClick={() => setEditing("new")}>Add user</Button>
      </PageHeader>
      {error ? <ErrorNote message={error} /> : null}
      {db.users.length === 0 ? <EmptyState title="No users" body="An owner account is created with the hotel API." /> : (
        <section className="panel record-list">
          {db.users.map((user) => (
            <article key={user.id} className="record" style={{ ["--cols" as string]: "1.4fr 1.2fr 0.8fr 0.6fr auto" }}>
              <div><span className="stack-label">Name</span><strong>{user.name}</strong></div>
              <div><span className="stack-label">Email</span>{user.email}</div>
              <div><span className="stack-label">Role</span>{user.role === "owner" ? "Owner" : "Receptionist"}</div>
              <div><span className="stack-label">State</span>{user.active ? "Active" : "Inactive"}</div>
              <div className="row-actions">
                <Button type="button" variant="secondary" onClick={() => setEditing(user)}>Edit</Button>
                {user.active ? <Button type="button" variant="danger" onClick={() => { const result = deactivateUser(user.id); if (!result.ok) setError(result.error); else notify(`${user.name} deactivated.`); }}>Deactivate</Button> : null}
              </div>
            </article>
          ))}
        </section>
      )}
      {editing ? <UserForm target={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function UserForm({ target, onClose }: { target: UserAccount | "new"; onClose: () => void }) {
  const existing = target === "new" ? null : target;
  const { saveUser, notify } = useHotel();
  const [name, setName] = useState(existing?.name ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [role, setRole] = useState<Role>(existing?.role ?? "receptionist");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  return (
    <Modal open title={existing ? "Edit user" : "Add user"} onClose={onClose}>
      <form className="form-grid" onSubmit={(event) => {
        event.preventDefault();
        const result = saveUser({ name, email, role, password: password || existing?.password || "" }, existing?.id);
        if (!result.ok) setError(result.error);
        else { notify("User saved."); onClose(); }
      }}>
        <Field label="Name"><TextInput value={name} onChange={(event) => setName(event.target.value)} required /></Field>
        <Field label="Email"><TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></Field>
        <Field label="Role">
          <SelectInput value={role} onChange={(event) => setRole(event.target.value as Role)}>
            <option value="owner">Owner</option>
            <option value="receptionist">Receptionist</option>
          </SelectInput>
        </Field>
        <Field label="Password" hint={existing ? "Leave blank to keep the current password." : "Demo passwords stay on this device."}>
          <TextInput type="password" value={password} onChange={(event) => setPassword(event.target.value)} required={!existing} />
        </Field>
        {error ? <ErrorNote message={error} /> : null}
        <div className="sticky-actions">
          <Button type="submit">Save user</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}
