import siteConfig from "@config";
import { bookingsFrom, type BookingRow } from "@/lib/db";
import { cobradoCents, precioSinConfirmar } from "@/lib/price";
import { nowInBusinessTz } from "@/lib/time";

/*
 * Estadísticas del negocio, calculadas a partir de las reservas.
 *
 * Dos criterios que conviene tener claros al leer los números:
 *
 *   1. Cuenta como ingreso una cita confirmada o realizada. Las canceladas no
 *      suman, y las que están esperando la señal tampoco, porque todavía no son
 *      una cita en firme.
 *
 *   2. Se separa lo ya facturado (citas cuyo día ya pasó) de lo previsto (citas
 *      futuras ya reservadas). Meterlo todo en el mismo saco daría una foto
 *      demasiado optimista de lo que se lleva ganado.
 *
 *   3. Cuenta el precio realmente cobrado, no el de la reserva: si al terminar
 *      se ajustó el importe, es ese el que suma. Ver src/lib/price.ts.
 *
 * Los servicios con precio "desde" se guardan por su precio mínimo, así que
 * mientras no se confirme el precio final los ingresos son un suelo, nunca una
 * cifra inflada. Cuando queda alguna cita así, la interfaz lo advierte.
 */

const LOCALE = siteConfig.business.locale;

/** Estados que representan una cita real que genera ingreso. */
function counts(booking: BookingRow): boolean {
  return booking.status === "confirmed" || booking.status === "completed";
}

export type MonthStats = {
  /** "2026-08" */
  key: string;
  /** "ago 26" */
  label: string;
  revenueCents: number;
  bookings: number;
  cancelled: number;
  newClients: number;
};

export type ServiceStat = { name: string; count: number; revenueCents: number };

export type ClientStat = {
  name: string;
  email: string;
  phone: string;
  visits: number;
  spentCents: number;
  lastVisit: string;
};

export type Stats = {
  /** Últimos 12 meses en orden cronológico. */
  months: MonthStats[];
  thisMonth: MonthStats;
  lastMonth: MonthStats | null;
  /** Ya pasadas, en el mes en curso. */
  billedCents: number;
  /** Citas futuras ya reservadas, en el mes en curso. */
  upcomingCents: number;
  averageTicketCents: number;
  topServices: ServiceStat[];
  topClients: ClientStat[];
  totals: {
    clients: number;
    returningClients: number;
    bookings: number;
    revenueCents: number;
    depositsCents: number;
  };
  cancellationRate: number;
  /** Hay citas con precio "desde": los importes son un mínimo. */
  hasEstimated: boolean;
  /** No hay ninguna cita todavía. */
  empty: boolean;
};

function monthKey(date: string): string {
  return date.slice(0, 7);
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const text = new Intl.DateTimeFormat(LOCALE, {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
  return text.replace(".", "");
}

/** Resta meses a una clave "YYYY-MM". */
function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function buildStats(): Promise<Stats> {
  const today = nowInBusinessTz().date;
  const currentKey = monthKey(today);
  // Doce meses de historia bastan para ver la evolución sin traerlo todo.
  const since = `${shiftMonth(currentKey, -11)}-01`;

  const all = await bookingsFrom(since);
  const active = all.filter(counts);

  /* --- Serie mensual ---------------------------------------------------- */
  const keys: string[] = [];
  for (let i = 11; i >= 0; i--) keys.push(shiftMonth(currentKey, -i));

  // Primera visita de cada clienta, para saber cuándo es "nueva".
  const firstVisit = new Map<string, string>();
  for (const b of [...active].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!firstVisit.has(b.client_email)) firstVisit.set(b.client_email, b.date);
  }

  const months: MonthStats[] = keys.map((key) => {
    const inMonth = active.filter((b) => monthKey(b.date) === key);
    const cancelled = all.filter(
      (b) => monthKey(b.date) === key && b.status === "cancelled",
    ).length;
    const newClients = new Set(
      inMonth
        .filter((b) => firstVisit.get(b.client_email) === b.date)
        .map((b) => b.client_email),
    ).size;

    return {
      key,
      label: monthLabel(key),
      revenueCents: inMonth.reduce((sum, b) => sum + cobradoCents(b), 0),
      bookings: inMonth.length,
      cancelled,
      newClients,
    };
  });

  const thisMonth = months[months.length - 1];
  const lastMonth = months.length > 1 ? months[months.length - 2] : null;

  /* --- Mes en curso: facturado vs previsto ------------------------------ */
  const monthBookings = active.filter((b) => monthKey(b.date) === currentKey);
  const billedCents = monthBookings
    .filter((b) => b.date <= today)
    .reduce((sum, b) => sum + cobradoCents(b), 0);
  const upcomingCents = monthBookings
    .filter((b) => b.date > today)
    .reduce((sum, b) => sum + cobradoCents(b), 0);

  /* --- Servicios más pedidos -------------------------------------------- */
  const byService = new Map<string, ServiceStat>();
  for (const b of active) {
    const entry = byService.get(b.service_name) ?? {
      name: b.service_name,
      count: 0,
      revenueCents: 0,
    };
    entry.count += 1;
    entry.revenueCents += cobradoCents(b);
    byService.set(b.service_name, entry);
  }
  const topServices = [...byService.values()]
    .sort((a, b) => b.count - a.count || b.revenueCents - a.revenueCents)
    .slice(0, 6);

  /* --- Clientas ---------------------------------------------------------- */
  const byClient = new Map<string, ClientStat>();
  for (const b of active) {
    const entry = byClient.get(b.client_email) ?? {
      name: b.client_name,
      email: b.client_email,
      phone: b.client_phone,
      visits: 0,
      spentCents: 0,
      lastVisit: b.date,
    };
    entry.visits += 1;
    entry.spentCents += cobradoCents(b);
    // Se queda con el nombre y el teléfono de la reserva más reciente.
    if (b.date >= entry.lastVisit) {
      entry.lastVisit = b.date;
      entry.name = b.client_name;
      entry.phone = b.client_phone;
    }
    byClient.set(b.client_email, entry);
  }
  const clients = [...byClient.values()];
  const topClients = clients
    .sort((a, b) => b.visits - a.visits || b.spentCents - a.spentCents)
    .slice(0, 8);

  /* --- Totales ----------------------------------------------------------- */
  const revenueCents = active.reduce((sum, b) => sum + cobradoCents(b), 0);
  const cancelledCount = all.filter((b) => b.status === "cancelled").length;
  const decided = active.length + cancelledCount;

  return {
    months,
    thisMonth,
    lastMonth,
    billedCents,
    upcomingCents,
    averageTicketCents: active.length ? Math.round(revenueCents / active.length) : 0,
    topServices,
    topClients,
    totals: {
      clients: clients.length,
      returningClients: clients.filter((c) => c.visits > 1).length,
      bookings: active.length,
      revenueCents,
      depositsCents: active
        .filter((b) => b.deposit_status === "paid")
        .reduce((sum, b) => sum + b.deposit_cents, 0),
    },
    cancellationRate: decided ? Math.round((cancelledCount / decided) * 100) : 0,
    hasEstimated: active.some(precioSinConfirmar),
    empty: active.length === 0,
  };
}
