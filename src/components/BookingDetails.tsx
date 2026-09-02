import siteConfig from "@config";
import type { BookingRow } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { cobradoCents, precioSinConfirmar } from "@/lib/price";
import { extrasDe, serviciosDe, textoExtra } from "@/lib/servicios";
import { formatDateLong, formatDuration } from "@/lib/time";

const STATUS_LABELS: Record<BookingRow["status"], { text: string; className: string }> = {
  confirmed: { text: "Confirmada", className: "bg-green-100 text-green-800" },
  pending_payment: { text: "Pendiente de señal", className: "bg-amber-100 text-amber-900" },
  cancelled: { text: "Cancelada", className: "bg-red-100 text-red-800" },
  completed: { text: "Realizada", className: "bg-line text-muted" },
};

export function StatusBadge({ status }: { status: BookingRow["status"] }) {
  const label = STATUS_LABELS[status];
  return (
    <span
      className={`inline-block px-3 py-1 text-[12px] font-semibold ${label.className}`}
    >
      {label.text}
    </span>
  );
}

/** Ficha con todos los datos de una cita. Se reutiliza en varias páginas. */
export function BookingDetails({ booking }: { booking: BookingRow }) {
  const servicios = serviciosDe(booking);
  const addOns = extrasDe(booking);
  /*
   * Si la cita ya se hizo y el precio se cerró en otra cifra, manda esa: es la
   * que la clienta pagó, y verla aquí es lo único que le permite comprobar que
   * su historial cuadra con lo que recuerda.
   */
  const precio = cobradoCents(booking);
  const rest = Math.max(0, precio - (booking.deposit_status === "paid" ? booking.deposit_cents : 0));

  return (
    <dl className="divide-y divide-line">
      <Row
        label={servicios.length > 1 ? "Servicios" : "Servicio"}
        value={servicios.map((s) => s.name).join(" + ")}
      />
      {addOns.length > 0 && (
        <Row label="Extras" value={addOns.map(textoExtra).join(", ")} />
      )}
      <Row label="Día" value={capitalize(formatDateLong(booking.date))} />
      <Row
        label="Hora"
        value={`${booking.start_time} – ${booking.end_time} · ${formatDuration(booking.duration_min)}`}
      />
      <Row
        label="Precio"
        value={`${precioSinConfirmar(booking) ? "desde " : ""}${formatCents(precio)}`}
      />
      {booking.deposit_status === "paid" && (
        <Row
          label="Señal pagada"
          value={`${formatCents(booking.deposit_cents)} · quedan ${formatCents(rest)}${precioSinConfirmar(booking) ? " o más" : ""} ${siteConfig.venue.payWhere}`}
        />
      )}
      {booking.deposit_status === "pending" && (
        <Row label="Señal pendiente" value={formatCents(booking.deposit_cents)} />
      )}
      {booking.deposit_status === "on_site" && (
        <Row label="Pago" value={`Importe completo ${siteConfig.venue.payWhere}`} />
      )}
      <Row label="A nombre de" value={booking.client_name} />
      <Row label="Contacto" value={`${booking.client_email} · ${booking.client_phone}`} />
      {siteConfig.venue.needsClientAddress && booking.client_address && (
        <Row label="Dirección" value={booking.client_address} />
      )}
      {booking.notes && <Row label="Nota" value={booking.notes} />}
      <Row label="Código" value={booking.code} mono />
      <Row label="Dónde" value={siteConfig.business.address.area} />
    </dl>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-6 gap-y-1 py-3">
      <dt className="text-[13.5px] text-muted">{label}</dt>
      <dd
        className={`max-w-[62%] text-right text-[14px] font-medium text-ink ${
          mono ? "font-mono tracking-wide" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}


export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
