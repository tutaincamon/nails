import siteConfig, { type TimeRange } from "@config";
import {
  blocksBetween,
  bookingsBetween,
  getDayHours,
  getWeeklyHours,
  type BlockRow,
  type BookingRow,
  type DiasSueltos,
  type WeeklyHours,
} from "@/lib/db";
import {
  addDays,
  daysBetween,
  endTime,
  nowInBusinessTz,
  toMinutes,
  toTime,
  weekdayOf,
} from "@/lib/time";

/*
 * Motor de disponibilidad.
 *
 * Un hueco se ofrece solo si TODO esto se cumple:
 *   1. Ese día se trabaja (horario semanal, y no está en closedDates).
 *   2. El servicio entra completo dentro de una misma franja de trabajo
 *      (no se parte a la mitad del descanso de comida).
 *   3. No se solapa con otra cita ni con un bloqueo manual de la agenda,
 *      dejando además los minutos de limpieza entre clientas.
 *   4. Hay la antelación mínima configurada.
 *   5. No se ha superado el máximo de citas del día.
 */

export type Slot = { start: string; end: string };

export type DayAvailability = {
  date: string;
  /** No se trabaja ese día, o ya pasó, o está fuera del rango reservable. */
  closed: boolean;
  closedReason?: string;
  slots: Slot[];
};

type Interval = { start: number; end: number };

/**
 * Horario que manda de verdad: el que la profesional haya guardado en el panel
 * y, si no ha tocado nada, el del archivo de configuración.
 */
export async function effectiveHours(): Promise<WeeklyHours> {
  try {
    return (await getWeeklyHours()) ?? siteConfig.hours;
  } catch (error) {
    // Si la base de datos no responde, es preferible el horario de la
    // configuración a dejar la agenda entera cerrada.
    console.error("[agenda] No se pudo leer el horario guardado:", error);
    return siteConfig.hours;
  }
}

/**
 * Franjas de trabajo de un día.
 *
 * Manda lo más concreto: si esa fecha tiene horario propio, es el que vale,
 * aunque sea una lista vacía —que significa "ese día no trabajo"—. Solo cuando
 * la fecha no está planificada se recurre al horario semanal.
 */
export function workingRanges(
  date: string,
  hours: WeeklyHours,
  dias: DiasSueltos = {},
): TimeRange[] {
  if (siteConfig.closedDates.includes(date)) return [];
  const propio = dias[date];
  if (propio) return propio;
  return hours[weekdayOf(date)] ?? [];
}

/** Intervalos ocupados de un día, en minutos desde medianoche. */
function occupiedIntervals(
  date: string,
  bookings: BookingRow[],
  blocks: BlockRow[],
): Interval[] {
  const { bufferMinutes } = siteConfig.booking;

  const fromBookings = bookings
    .filter((b) => b.date === date)
    .map((b) => ({
      start: toMinutes(b.start_time),
      // La cita reserva también los minutos de limpieza posteriores.
      end: toMinutes(b.end_time) + bufferMinutes,
    }));

  const fromBlocks = blocks
    .filter((b) => b.date === date)
    .map((b) => ({ start: toMinutes(b.start_time), end: toMinutes(b.end_time) }));

  return [...fromBookings, ...fromBlocks];
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Calcula la disponibilidad de un rango de días de una vez.
 * Hace una sola consulta a la base de datos para todo el rango.
 */
export async function availabilityRange(
  fromDate: string,
  days: number,
  durationMin: number,
  /*
   * Código de una cita que NO cuenta como ocupada. Hace falta al mover una cita
   * desde el panel: sin esto chocaría consigo misma y no se podría ni
   * adelantarla media hora.
   */
  ignorar?: string,
): Promise<DayAvailability[]> {
  const { slotMinutes, bufferMinutes, minNoticeHours, maxDaysAhead, maxPerDay } =
    siteConfig.booking;

  const now = nowInBusinessTz();
  const lastDate = addDays(fromDate, Math.max(0, days - 1));
  // El horario se lee una sola vez para todo el rango, no una por día.
  const [todas, blocks, hours, dias] = await Promise.all([
    bookingsBetween(fromDate, lastDate),
    blocksBetween(fromDate, lastDate),
    effectiveHours(),
    // Si esta consulta fallara, se sigue con el horario semanal antes que
    // dejar la agenda entera cerrada.
    getDayHours(fromDate, lastDate).catch(() => ({}) as DiasSueltos),
  ]);

  const bookings = ignorar ? todas.filter((b) => b.code !== ignorar) : todas;

  const result: DayAvailability[] = [];

  for (let i = 0; i < days; i++) {
    const date = addDays(fromDate, i);
    const offsetFromToday = daysBetween(now.date, date);

    if (offsetFromToday < 0) {
      result.push({ date, closed: true, closedReason: "Fecha pasada", slots: [] });
      continue;
    }
    if (offsetFromToday > maxDaysAhead) {
      result.push({ date, closed: true, closedReason: "Agenda aún no abierta", slots: [] });
      continue;
    }

    const ranges = workingRanges(date, hours, dias);
    if (ranges.length === 0) {
      result.push({ date, closed: true, closedReason: "Cerrado", slots: [] });
      continue;
    }

    const dayBookings = bookings.filter((b) => b.date === date);
    if (maxPerDay > 0 && dayBookings.length >= maxPerDay) {
      result.push({ date, closed: true, closedReason: "Agenda completa", slots: [] });
      continue;
    }

    const occupied = occupiedIntervals(date, dayBookings, blocks);
    // Primera hora reservable ese día, expresada en minutos desde su medianoche.
    // Si sale negativa, la antelación mínima ya se cumple a cualquier hora.
    const earliestMinute = now.minutes + minNoticeHours * 60 - offsetFromToday * 1440;

    const slots: Slot[] = [];

    for (const range of ranges) {
      const rangeStart = toMinutes(range.start);
      const rangeEnd = toMinutes(range.end);

      /*
       * Horas candidatas: la rejilla de siempre MÁS el minuto exacto en que
       * queda libre después de cada cita.
       *
       * Solo con la rejilla se perdía tiempo tonto. Con servicios de 20 min y
       * 45 de desplazamiento, tras una cita a las 10:00 queda libre a las
       * 11:05, pero la rejilla de 30 no ofrecía nada hasta las 11:30: media
       * hora muerta que nadie podía reservar. Añadiendo ese 11:05 el día se
       * compacta sin llenar la pantalla de horas.
       *
       * Se redondea al múltiplo de 5 siguiente para no ofrecer las 11:03.
       */
      const candidatos = new Set<number>();
      for (let s = rangeStart; s + durationMin <= rangeEnd; s += slotMinutes) candidatos.add(s);
      for (const ocupado of occupied) {
        const libre = Math.ceil(ocupado.end / 5) * 5;
        if (libre >= rangeStart && libre + durationMin <= rangeEnd) candidatos.add(libre);
      }

      for (const start of [...candidatos].sort((a, b) => a - b)) {
        if (start < earliestMinute) continue;

        const candidate: Interval = { start, end: start + durationMin + bufferMinutes };
        const fits = !occupied.some((o) => overlaps(candidate, o));
        if (fits) {
          slots.push({ start: toTime(start), end: toTime(start + durationMin) });
        }
      }
    }

    result.push({ date, closed: slots.length === 0, closedReason: undefined, slots });
  }

  return result;
}

/** Disponibilidad de un solo día. */
export async function availabilityForDate(
  date: string,
  durationMin: number,
  ignorar?: string,
): Promise<DayAvailability> {
  return (await availabilityRange(date, 1, durationMin, ignorar))[0];
}

/**
 * Comprobación final antes de guardar. El navegador puede enviar una hora que
 * acaba de ocuparse, así que el servidor siempre vuelve a validar aquí.
 */
export async function isSlotBookable(
  date: string,
  start: string,
  durationMin: number,
  ignorar?: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const day = await availabilityForDate(date, durationMin, ignorar);

  if (day.closed && day.slots.length === 0) {
    return { ok: false, reason: day.closedReason ?? "Ese día no hay huecos disponibles." };
  }
  const match = day.slots.find((s) => s.start === start);
  if (!match) {
    return {
      ok: false,
      reason: `Las ${start} ya no está libre. Elige otra hora, por favor.`,
    };
  }
  if (match.end !== endTime(start, durationMin)) {
    return { ok: false, reason: "La duración del servicio no encaja en ese hueco." };
  }
  return { ok: true };
}

/** Primeros N días con al menos un hueco libre, para sugerir fechas. */
export async function nextAvailableDays(
  durationMin: number,
  count = 3,
): Promise<DayAvailability[]> {
  const { maxDaysAhead } = siteConfig.booking;
  const today = nowInBusinessTz().date;
  const days = await availabilityRange(today, maxDaysAhead + 1, durationMin);
  return days.filter((d) => d.slots.length > 0).slice(0, count);
}
