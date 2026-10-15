import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { roomOperationalStatus } from "../domain/availability";
import { roomTypeName } from "../domain/lookup";
import type { Room, RoomType } from "../domain/types";
import { useHotel } from "../state/HotelProvider";
import { Button, EmptyState, ErrorNote, Field, Modal, Money, PageHeader, SearchField, SelectInput, StatusBadge, TextInput } from "../components/ui";

export function RoomsPage() {
  const { db, can } = useHotel();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<"rooms" | "types">(params.get("tab") === "types" ? "types" : "rooms");
  const [editingRoom, setEditingRoom] = useState<Room | "new" | null>(null);
  const [editingType, setEditingType] = useState<RoomType | "new" | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    if (params.get("tab") === "types") setTab("types");
    if (params.get("new") === "1" && can("rooms.manage")) {
      setEditingRoom("new");
      const next = new URLSearchParams(params);
      next.delete("new");
      setParams(next, { replace: true });
    }
  }, [params, can, setParams]);

  return (
    <div className="page">
      <PageHeader title="Rooms and types" lede="Inventory, prices, and types come from the hotel record. Deactivating a room keeps its history.">
        {tab === "rooms" && can("rooms.manage") ? <Button type="button" onClick={() => setEditingRoom("new")}>Add room</Button> : null}
        {tab === "types" && can("rates.manage") ? <Button type="button" onClick={() => setEditingType("new")}>Add room type</Button> : null}
      </PageHeader>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "rooms"} className={tab === "rooms" ? "active" : ""} onClick={() => { setTab("rooms"); setParams({}); }}>Rooms</button>
        <button type="button" role="tab" aria-selected={tab === "types"} className={tab === "types" ? "active" : ""} onClick={() => { setTab("types"); setParams({ tab: "types" }); }}>Room types</button>
      </div>
      {tab === "rooms" ? (
        <RoomTable showInactive={showInactive} onToggle={() => setShowInactive((value) => !value)} onEdit={setEditingRoom} />
      ) : (
        <TypeTable onEdit={setEditingType} />
      )}
      {editingRoom ? <RoomForm target={editingRoom} onClose={() => { setEditingRoom(null); setParams(tab === "types" ? { tab: "types" } : {}); }} /> : null}
      {editingType ? <TypeForm target={editingType} onClose={() => setEditingType(null)} /> : null}
      {db.roomTypes.length === 0 && can("rates.manage") ? <p className="hint">Create a room type before adding rooms.</p> : null}
    </div>
  );
}

function RoomTable({ showInactive, onToggle, onEdit }: { showInactive: boolean; onToggle: () => void; onEdit: (room: Room) => void }) {
  const { db, today, can, setMaintenance, deactivateRoom, notify } = useHotel();
  const [query, setQuery] = useState("");
  const [typeId, setTypeId] = useState("all");
  const [status, setStatus] = useState("all");
  const [error, setError] = useState("");
  const rooms = db.rooms
    .filter((room) => showInactive || room.inventoryStatus === "active")
    .filter((room) => room.roomNumber.toLowerCase().includes(query.trim().toLowerCase()))
    .filter((room) => typeId === "all" || room.roomTypeId === typeId)
    .filter((room) => status === "all" || roomOperationalStatus(db, room, today) === status)
    .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));

  return (
    <section className="panel">
      <div className="toolbar">
        <SearchField value={query} onChange={setQuery} placeholder="Search room number" />
        <SelectInput aria-label="Room type" value={typeId} onChange={(event) => setTypeId(event.target.value)}>
          <option value="all">All types</option>
          {db.roomTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
        </SelectInput>
        <SelectInput aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All statuses</option>
          <option value="available">Available</option>
          <option value="occupied">Occupied</option>
          <option value="reserved">Reserved</option>
          <option value="maintenance">Maintenance</option>
          {showInactive ? <option value="inactive">Deactivated</option> : null}
        </SelectInput>
        <label className="check-row">
          <input type="checkbox" checked={showInactive} onChange={onToggle} />
          Show deactivated
        </label>
      </div>
      {error ? <ErrorNote message={error} /> : null}
      {rooms.length === 0 ? <EmptyState title="No rooms yet" body="When a room is added, it appears in this list and on the overview." /> : (
        <div className="record-list">
          <div className="record record-head" style={{ ["--cols" as string]: "0.8fr 0.6fr 1fr 0.8fr 0.9fr auto" }}>
            <span>Room</span><span>Floor</span><span>Type</span><span>Price</span><span>Status</span><span />
          </div>
          {rooms.map((room) => {
            const operational = roomOperationalStatus(db, room, today);
            return (
              <article key={room.id} className="record" style={{ ["--cols" as string]: "0.8fr 0.6fr 1fr 0.8fr 0.9fr auto" }}>
                <div><span className="stack-label">Room</span><strong>{room.roomNumber}</strong></div>
                <div><span className="stack-label">Floor</span>{room.floor}</div>
                <div><span className="stack-label">Type</span>{roomTypeName(db, room.roomTypeId)}</div>
                <div><span className="stack-label">Price</span><Money amount={room.basePrice} /></div>
                <div><span className="stack-label">Status</span><StatusBadge status={operational} /></div>
                {can("rooms.manage") ? (
                  <div className="row-actions">
                    <Button type="button" variant="secondary" onClick={() => onEdit(room)}>Edit</Button>
                    <Button type="button" variant="secondary" onClick={() => { const result = setMaintenance(room.id, !room.maintenance); if (!result.ok) setError(result.error); else notify(room.maintenance ? "Maintenance cleared." : "Room marked for maintenance."); }}>{room.maintenance ? "Clear maintenance" : "Maintenance"}</Button>
                    {room.inventoryStatus === "active" ? <Button type="button" variant="danger" onClick={() => { const result = deactivateRoom(room.id); if (!result.ok) setError(result.error); else notify(`Room ${room.roomNumber} deactivated. Its bookings remain.`); }}>Deactivate</Button> : null}
                  </div>
                ) : <span />}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function TypeTable({ onEdit }: { onEdit: (type: RoomType) => void }) {
  const { db, can, deactivateRoomType, notify } = useHotel();
  const [error, setError] = useState("");
  if (db.roomTypes.length === 0) return <EmptyState title="No room types" body="Add Standard, Suite, or any name you use. The rest of the app reads this list." />;
  return (
    <section className="panel">
      {error ? <ErrorNote message={error} /> : null}
      <div className="record-list">
        {db.roomTypes.map((type) => (
          <article key={type.id} className="record" style={{ ["--cols" as string]: "1.2fr 0.8fr 0.7fr 1fr auto" }}>
            <div><span className="stack-label">Type</span><strong>{type.name}</strong><small className="hint">{type.description}</small></div>
            <div><span className="stack-label">Default rate</span><Money amount={type.defaultRate} /></div>
            <div><span className="stack-label">Occupancy</span>{type.maxOccupancy}</div>
            <div><span className="stack-label">State</span>{type.active ? "Active" : "Inactive"}</div>
            {can("rates.manage") ? (
              <div className="row-actions">
                <Button type="button" variant="secondary" onClick={() => onEdit(type)}>Edit</Button>
                {type.active ? <Button type="button" variant="danger" onClick={() => { const result = deactivateRoomType(type.id); if (!result.ok) setError(result.error); else notify(`${type.name} deactivated.`); }}>Deactivate</Button> : null}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function RoomForm({ target, onClose }: { target: Room | "new"; onClose: () => void }) {
  const { db, saveRoom, notify } = useHotel();
  const existing = target === "new" ? null : target;
  const startingType = existing?.roomTypeId ?? db.roomTypes.find((type) => type.active)?.id ?? "";
  const [roomNumber, setRoomNumber] = useState(existing?.roomNumber ?? "");
  const [floor, setFloor] = useState(existing?.floor ?? "");
  const [roomTypeId, setRoomTypeId] = useState(startingType);
  const [capacity, setCapacity] = useState(String(existing?.capacity ?? db.roomTypes.find((type) => type.id === startingType)?.maxOccupancy ?? 1));
  const [basePrice, setBasePrice] = useState(String(existing?.basePrice ?? db.roomTypes.find((type) => type.id === startingType)?.defaultRate ?? ""));
  const [priceDirty, setPriceDirty] = useState(Boolean(existing));
  const [amenities, setAmenities] = useState(existing?.amenities.join(", ") ?? "");
  const [maintenance, setMaintenanceFlag] = useState(existing?.maintenance ?? false);
  const [error, setError] = useState("");

  return (
    <Modal open title={existing ? `Edit room ${existing.roomNumber}` : "Add room"} onClose={onClose}>
      <form className="form-grid" onSubmit={(event) => {
        event.preventDefault();
        const result = saveRoom({
          roomNumber,
          floor,
          roomTypeId,
          capacity: Number(capacity),
          amenities: amenities.split(","),
          basePrice: Number(basePrice),
          maintenance,
        }, existing?.id);
        if (!result.ok) setError(result.error);
        else { notify(existing ? "Room updated. Existing agreed rates were not changed." : "Room added to the inventory."); onClose(); }
      }}>
        <Field label="Room number" hint="Any label is fine. Numbers do not need to be sequential.">
          <TextInput value={roomNumber} onChange={(event) => setRoomNumber(event.target.value)} required />
        </Field>
        <Field label="Floor">
          <TextInput value={floor} onChange={(event) => setFloor(event.target.value)} required />
        </Field>
        <Field label="Room type">
          <SelectInput value={roomTypeId} onChange={(event) => {
            const next = event.target.value;
            setRoomTypeId(next);
            if (!priceDirty) {
              const type = db.roomTypes.find((item) => item.id === next);
              if (type) setBasePrice(String(type.defaultRate));
            }
            const type = db.roomTypes.find((item) => item.id === next);
            if (!existing && type) setCapacity(String(type.maxOccupancy));
          }} required>
            <option value="">Choose a type</option>
            {db.roomTypes.filter((type) => type.active || type.id === existing?.roomTypeId).map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
          </SelectInput>
        </Field>
        <Field label="Capacity">
          <TextInput inputMode="numeric" value={capacity} onChange={(event) => setCapacity(event.target.value)} required />
        </Field>
        <Field label="Base price" hint="This is the room's own price. Changing it does not rewrite existing reservations.">
          <TextInput inputMode="decimal" value={basePrice} onChange={(event) => { setPriceDirty(true); setBasePrice(event.target.value); }} required />
        </Field>
        <Field label="Amenities" hint="Separate items with commas.">
          <TextInput value={amenities} onChange={(event) => setAmenities(event.target.value)} />
        </Field>
        <label className="check-row">
          <input type="checkbox" checked={maintenance} onChange={(event) => setMaintenanceFlag(event.target.checked)} />
          Unavailable for maintenance
        </label>
        {error ? <ErrorNote message={error} /> : null}
        <div className="sticky-actions">
          <Button type="submit">{existing ? "Save room" : "Add room"}</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}

function TypeForm({ target, onClose }: { target: RoomType | "new"; onClose: () => void }) {
  const { saveRoomType, notify } = useHotel();
  const existing = target === "new" ? null : target;
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [defaultRate, setDefaultRate] = useState(String(existing?.defaultRate ?? ""));
  const [maxOccupancy, setMaxOccupancy] = useState(String(existing?.maxOccupancy ?? 2));
  const [amenities, setAmenities] = useState(existing?.amenities.join(", ") ?? "");
  const [active, setActive] = useState(existing?.active ?? true);
  const [error, setError] = useState("");
  return (
    <Modal open title={existing ? `Edit ${existing.name}` : "New room type"} onClose={onClose}>
      <form className="form-grid" onSubmit={(event) => {
        event.preventDefault();
        const result = saveRoomType({
          name,
          description,
          defaultRate: Number(defaultRate),
          maxOccupancy: Number(maxOccupancy),
          amenities: amenities.split(","),
          active,
        }, existing?.id);
        if (!result.ok) setError(result.error);
        else { notify("Room type saved. Reservations keep the rate that was agreed."); onClose(); }
      }}>
        <Field label="Name"><TextInput value={name} onChange={(event) => setName(event.target.value)} required /></Field>
        <Field label="Description"><TextInput value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
        <Field label="Default rate" hint="Used as a starting price for new rooms. It does not change agreed rates.">
          <TextInput inputMode="decimal" value={defaultRate} onChange={(event) => setDefaultRate(event.target.value)} required />
        </Field>
        <Field label="Maximum occupancy"><TextInput inputMode="numeric" value={maxOccupancy} onChange={(event) => setMaxOccupancy(event.target.value)} required /></Field>
        <Field label="Amenities"><TextInput value={amenities} onChange={(event) => setAmenities(event.target.value)} /></Field>
        <label className="check-row"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Active for new rooms</label>
        {error ? <ErrorNote message={error} /> : null}
        <div className="sticky-actions">
          <Button type="submit">Save type</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}
