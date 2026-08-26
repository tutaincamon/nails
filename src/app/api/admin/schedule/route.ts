import { NextResponse, type NextRequest } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { resetWeeklyHours, saveWeeklyHours, type WeeklyHours } from "@/lib/db";
import { toMinutes } from "@/lib/time";

export const runtime = "nodejs";

/*
 * Horario semanal editable desde el panel.
 *
 * Se valida entero antes de guardar nada: un horario a medias (un día con la
 * hora de fin antes que la de inicio, dos franjas solapadas) dejaría la agenda
 * ofreciendo huecos imposibles, y eso se descubre cuando ya hay una clienta
 * esperando en la puerta.
 */

const TIME_RE = /^\d{2}:\d{2}$/;

type ParsedRange = { start: string; end: string };

function parseDay(raw: unknown, dayName: string): ParsedRange[] | { error: string } {
  if (!Array.isArray(raw)) return { error: `Horario de ${dayName} no válido.` };

  const ranges: ParsedRange[] = [];

  for (const item of raw) {
    const range = item as Record<string, unknown>;
    const start = typeof range?.start === "string" ? range.start : "";
    const end = typeof range?.end === "string" ? range.end : "";

    if (!TIME_RE.test(start) || !TIME_RE.test(end)) {
      return { error: `${dayName}: las horas deben ir en formato HH:MM.` };
    }
    if (toMinutes(start) >= toMinutes(end)) {
      return { error: `${dayName}: la hora de fin (${end}) tiene que ser posterior a la de inicio (${start}).` };
    }
    ranges.push({ start, end });
  }

  // Ordenadas para poder comprobar solapes de una pasada, y porque así se
  // guardan siempre igual aunque el panel las mande desordenadas.
  ranges.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));

  for (let i = 1; i < ranges.length; i++) {
    if (toMinutes(ranges[i].start) < toMinutes(ranges[i - 1].end)) {
      return { error: `${dayName}: hay dos franjas que se pisan (${ranges[i - 1].start}–${ranges[i - 1].end} y ${ranges[i].start}–${ranges[i].end}).` };
    }
  }

  return ranges;
}

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/** POST /api/admin/schedule — guardar el horario semanal completo. */
export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const incoming = body.hours as Record<string, unknown> | undefined;

  if (!incoming || typeof incoming !== "object") {
    return NextResponse.json({ ok: false, error: "Falta el horario." }, { status: 400 });
  }

  const hours: WeeklyHours = {};

  for (let day = 0; day < 7; day++) {
    const parsed = parseDay(incoming[String(day)] ?? [], DAY_NAMES[day]);
    if ("error" in parsed) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }
    hours[day] = parsed;
  }

  await saveWeeklyHours(hours);
  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/schedule — volver al horario del archivo de configuración. */
export async function DELETE() {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  await resetWeeklyHours();
  return NextResponse.json({ ok: true });
}
