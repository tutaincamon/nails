import { NextResponse, type NextRequest } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { clearDayHours, setDayHours } from "@/lib/db";
import { toMinutes } from "@/lib/time";

export const runtime = "nodejs";

const TIME_RE = /^\d{2}:\d{2}$/;

/*
 * POST /api/admin/dias — fija el horario de un día concreto.
 *
 *   { date, ranges: [...] }  Ese día pasa a tener ese horario. Lista vacía
 *                            significa "ese día no trabajo".
 *   { date, seguir: true }   Ese día vuelve a seguir el horario semanal.
 *
 * La diferencia entre "vacío" y "seguir" importa: confundirlos abriría un día
 * que ella había cerrado a mano, o cerraría uno que solo quería devolver a su
 * horario normal.
 */
export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const date = typeof body.date === "string" ? body.date : "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, error: "Fecha no válida." }, { status: 400 });
  }

  if (body.seguir === true) {
    await clearDayHours(date);
    return NextResponse.json({ ok: true, seguir: true });
  }

  if (!Array.isArray(body.ranges)) {
    return NextResponse.json({ ok: false, error: "Faltan las franjas." }, { status: 400 });
  }

  const ranges: { start: string; end: string }[] = [];
  for (const item of body.ranges) {
    const r = item as Record<string, unknown>;
    const start = typeof r?.start === "string" ? r.start : "";
    const end = typeof r?.end === "string" ? r.end : "";

    if (!TIME_RE.test(start) || !TIME_RE.test(end)) {
      return NextResponse.json(
        { ok: false, error: "Las horas van en formato HH:MM." },
        { status: 400 },
      );
    }
    if (toMinutes(start) >= toMinutes(end)) {
      return NextResponse.json(
        { ok: false, error: `La hora de fin (${end}) tiene que ser posterior a la de inicio (${start}).` },
        { status: 400 },
      );
    }
    ranges.push({ start, end });
  }

  ranges.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  for (let i = 1; i < ranges.length; i++) {
    if (toMinutes(ranges[i].start) < toMinutes(ranges[i - 1].end)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Hay dos franjas que se pisan (${ranges[i - 1].start}–${ranges[i - 1].end} y ${ranges[i].start}–${ranges[i].end}).`,
        },
        { status: 400 },
      );
    }
  }

  await setDayHours(date, ranges);
  return NextResponse.json({ ok: true });
}
