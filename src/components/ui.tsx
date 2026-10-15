import { useEffect, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, cloneElement } from "react";
import { BedDouble, CalendarClock, CircleCheck, CircleOff, Wrench, type LucideIcon } from "lucide-react";
import { statusLabel } from "../domain/metrics";
import type { OperationalStatus } from "../domain/types";
import { formatMoney } from "../domain/money";
import { useHotel } from "../state/HotelProvider";

export function Button({ variant = "primary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return <button {...props} className={`btn btn-${variant} ${props.className ?? ""}`.trim()} />;
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactElement<InputHTMLAttributes<HTMLInputElement> | SelectHTMLAttributes<HTMLSelectElement>> }) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      {cloneElement(children, { id, "aria-invalid": error ? true : undefined })}
      {hint ? <small className="hint">{hint}</small> : null}
      {error ? <small className="field-error">{error}</small> : null}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input ${props.className ?? ""}`.trim()} />;
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`input ${props.className ?? ""}`.trim()} />;
}

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-root" role="presentation" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog">×</button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function PageHeader({ title, lede, children }: { title: string; lede?: string; children?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {lede ? <p className="lede">{lede}</p> : null}
      </div>
      {children ? <div className="page-actions">{children}</div> : null}
    </header>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return <p className="error-note" role="alert">{message}</p>;
}

export function Pagination({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (page: number) => void }) {
  if (total === 0) return null;
  return (
    <div className="pager">
      <button type="button" className="btn btn-secondary" onClick={() => onPage(page - 1)} disabled={page <= 1}>Previous</button>
      <span>Page {page} of {pages} · {total} records</span>
      <button type="button" className="btn btn-secondary" onClick={() => onPage(page + 1)} disabled={page >= pages}>Next</button>
    </div>
  );
}

const STATUS_ICONS: Record<string, LucideIcon> = {
  available: CircleCheck,
  occupied: BedDouble,
  reserved: CalendarClock,
  maintenance: Wrench,
  inactive: CircleOff,
  pending: CalendarClock,
};

export function StatusBadge({ status }: { status: OperationalStatus | "inactive" | string }) {
  const known = status === "available" || status === "occupied" || status === "reserved" || status === "maintenance" || status === "inactive";
  const label = known ? statusLabel(status as OperationalStatus | "inactive") : status;
  const Glyph = STATUS_ICONS[status];
  return (
    <span className={`badge badge-${status}`}>
      {Glyph ? <Glyph aria-hidden size={14} strokeWidth={2} /> : null}
      {label}
    </span>
  );
}

export function Money({ amount }: { amount: number }) {
  const { db } = useHotel();
  return <span className="money">{formatMoney(amount, db.hotel.currency)}</span>;
}

export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  const id = useId();
  return (
    <label className="search" htmlFor={id}>
      <span className="sr-only">{placeholder}</span>
      <input id={id} className="input" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
