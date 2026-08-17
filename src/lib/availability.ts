import siteConfig, { type TimeRange } from "@config";
import { blocksBetween, bookingsBetween, type BlockRow, type BookingRow } from "@/lib/db";
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

/** Franjas de trabajo de un día según el horario semanal. */
export function workingRanges(date: string): TimeRange[] {
  if (siteConfig.closedDates.includes(date)) return [];
  return siteConfig.hours[weekdayOf(date)] ?? [];
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
export function availabilityRange(
  fromDate: string,
  days: number,
  durationMin: number,
): DayAvailability[] {
  const { slotMinutes, bufferMinutes, minNoticeHours, maxDaysAhead, maxPerDay } =
    siteConfig.booking;

  const now = nowInBusinessTz();
  const lastDate = addDays(fromDate, Math.max(0, days - 1));
  const bookings = bookingsBetween(fromDate, lastDate);
  const blocks = blocksBetween(fromDate, lastDate);

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

    const ranges = workingRanges(date);
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

      for (let start = rangeStart; start + durationMin <= rangeEnd; start += slotMinutes) {
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
export function availabilityForDate(date: string, durationMin: number): DayAvailability {
  return availabilityRange(date, 1, durationMin)[0];
}

/**
 * Comprobación final antes de guardar. El navegador puede enviar una hora que
 * acaba de ocuparse, así que el servidor siempre vuelve a validar aquí.
 */
export function isSlotBookable(
  date: string,
  start: string,
  durationMin: number,
): { ok: true } | { ok: false; reason: string } {
  const day = availabilityForDate(date, durationMin);

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
export function nextAvailableDays(durationMin: number, count = 3): DayAvailability[] {
  const { maxDaysAhead } = siteConfig.booking;
  const today = nowInBusinessTz().date;
  const days = availabilityRange(today, maxDaysAhead + 1, durationMin);
  return days.filter((d) => d.slots.length > 0).slice(0, count);
}
