import siteConfig from "@config";

/*
 * Todas las fechas del negocio se manejan como texto en hora local del estudio:
 *   fecha -> "YYYY-MM-DD"    hora -> "HH:MM"
 *
 * Así no hay sorpresas con UTC ni con el cambio de hora: lo que la profesional
 * ve en su agenda es exactamente lo que se guarda. Solo se convierte a zona
 * horaria real cuando hace falta saber "qué hora es ahora" (recordatorios).
 */

const TZ = siteConfig.business.timezone;
const LOCALE = siteConfig.business.locale;

/** Minutos desde medianoche, a partir de "HH:MM". */
export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** "HH:MM" a partir de minutos desde medianoche. */
export function toTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Fecha y hora actuales en la zona del estudio, como { date, time }. */
export function nowInBusinessTz(): { date: string; time: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  // Intl puede devolver "24" a medianoche en algunos entornos.
  const hour = get("hour") === "24" ? "00" : get("hour");
  const time = `${hour}:${get("minute")}`;
  return { date, time, minutes: toMinutes(time) };
}

/** Suma días a una fecha "YYYY-MM-DD" sin tocar zonas horarias. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Día de la semana (0 = domingo) de una fecha "YYYY-MM-DD". */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Diferencia en días entre dos fechas "YYYY-MM-DD" (b - a). */
export function daysBetween(a: string, b: string): number {
  const parse = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((parse(b) - parse(a)) / 86_400_000);
}

/** Horas que faltan desde ahora hasta una fecha+hora del estudio. */
export function hoursUntil(date: string, time: string): number {
  const now = nowInBusinessTz();
  const days = daysBetween(now.date, date);
  return (days * 1440 + toMinutes(time) - now.minutes) / 60;
}

/** "sábado, 12 de septiembre" */
export function formatDateLong(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** "sáb 12 sept" — versión corta para el selector de días */
export function formatDateShort(date: string): { weekday: string; day: string; month: string } {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(LOCALE, { ...opts, timeZone: "UTC" }).format(dt);
  return {
    weekday: fmt({ weekday: "short" }).replace(".", ""),
    day: fmt({ day: "numeric" }),
    month: fmt({ month: "short" }).replace(".", ""),
  };
}

/** "2 h 30 min" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/** Hora de fin de una cita, a partir de la hora de inicio y la duración. */
export function endTime(start: string, durationMin: number): string {
  return toTime(toMinutes(start) + durationMin);
}
