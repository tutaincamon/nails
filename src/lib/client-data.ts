import siteConfig from "@config";
import { holdCaducado } from "@/lib/availability";
import { bookingsForEmail, type BookingRow } from "@/lib/db";
import { hoursUntil } from "@/lib/time";

/*
 * Cuándo una clienta puede quitar su tarjeta o borrar sus datos.
 *
 * La idea de fondo: puede hacerlo siempre que no deje a la profesional
 * desprotegida. Si se pudiera borrar la tarjeta con una cita encima, bastaría
 * con reservar, quitarla y no aparecer para saltarse la política entera; y si
 * se pudiera justo después de cancelar tarde, sería la forma evidente de
 * esquivar el cargo que ya se ha generado.
 *
 * Por eso hay dos bloqueos, y ninguno es eterno:
 *   1. Citas por delante sin cancelar.
 *   2. Cargos pendientes de resolver, pero solo durante unos días. Pasado ese
 *      plazo se entiende que la profesional ya decidió, y no se puede tener a
 *      alguien sin poder borrar sus datos indefinidamente porque a ella se le
 *      olvidara pulsar un botón.
 */

/** Días que un cargo sin resolver sigue bloqueando el borrado. */
const DIAS_DE_GRACIA = 7;

export type Bloqueo =
  | { puede: true }
  | { puede: false; motivo: "cita-pendiente" | "cargo-pendiente"; cuando?: string };

function citaPorDelante(b: BookingRow): boolean {
  /*
   * Una reserva que se quedó a medias y ya perdió el hueco no es una cita: no
   * ocupa nada en la agenda, así que tampoco puede retenerle la tarjeta a
   * nadie. Sin esto, empezar una reserva y cerrar el navegador dejaba a la
   * clienta sin poder quitar su tarjeta hasta que pasara la fecha.
   */
  if (holdCaducado(b)) return false;
  return b.status !== "cancelled" && hoursUntil(b.date, b.start_time) >= 0;
}

function cargoSinResolver(b: BookingRow): boolean {
  if (!siteConfig.noShow.enabled) return false;
  if (b.no_show_cents > 0) return false; // ya se cobró: asunto cerrado
  // La canceló la profesional: no hay ningún cargo posible, así que tampoco
  // hay motivo para retenerle la tarjeta a la clienta.
  if (b.cancelled_by === "admin") return false;

  const horas = hoursUntil(b.date, b.start_time);
  if (horas >= 0) return false; // todavía no ha llegado

  // Solo dentro del plazo de gracia, y solo si de verdad quedó algo a deber.
  const diasDesde = -horas / 24;
  if (diasDesde > DIAS_DE_GRACIA) return false;

  const cancelada = b.status === "cancelled";
  const tardia = cancelada && b.cancelled_at
    ? hoursUntilFrom(b.cancelled_at, b.date, b.start_time) < siteConfig.booking.cancellationHours
    : false;

  // No presentarse (sigue confirmada y ya pasó) o haber cancelado fuera de plazo.
  return tardia || (!cancelada && b.status !== "completed");
}

/** Horas que quedaban para la cita en un instante dado. */
function hoursUntilFrom(iso: string, date: string, time: string): number {
  const cita = new Date(`${date}T${time}:00`).getTime();
  return (cita - new Date(iso).getTime()) / 3_600_000;
}

/** Comprueba si esa clienta puede borrar tarjeta o datos ahora mismo. */
export async function puedeBorrar(email: string): Promise<Bloqueo> {
  const citas = await bookingsForEmail(email, 100);

  const pendiente = citas.find(citaPorDelante);
  if (pendiente) {
    return { puede: false, motivo: "cita-pendiente", cuando: pendiente.date };
  }

  const conCargo = citas.find(cargoSinResolver);
  if (conCargo) {
    return { puede: false, motivo: "cargo-pendiente", cuando: conCargo.date };
  }

  return { puede: true };
}

/** Todas las tarjetas guardadas de esa clienta, para soltarlas en Stripe. */
export async function tarjetasDe(email: string): Promise<string[]> {
  const citas = await bookingsForEmail(email, 100);
  const metodos = citas.map((c) => c.card_payment_method).filter(Boolean);
  return [...new Set(metodos)];
}
