import { NextResponse, type NextRequest } from "next/server";
import siteConfig from "@config";
import { isAdmin } from "@/lib/admin-auth";
import { getBooking, markNoShowCharged, updateBookingStatus } from "@/lib/db";
import { chargeNoShow } from "@/lib/payments";
import { hoursUntil } from "@/lib/time";

export const runtime = "nodejs";

/*
 * POST /api/admin/no-show — cobrar a quien no apareció.
 *
 * Es la única acción del panel que mueve dinero de una clienta sin que ella
 * esté delante, así que se comprueba todo antes: que la política esté activa,
 * que la cita ya haya pasado, que aceptara las condiciones y que no se haya
 * cobrado ya. Cobrar de más aquí es un problema muy caro de deshacer.
 */
export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  if (!siteConfig.noShow.enabled) {
    return NextResponse.json(
      { ok: false, error: "La política de plantones no está activada." },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const code = typeof body.code === "string" ? body.code : "";

  const booking = await getBooking(code);
  if (!booking) {
    return NextResponse.json({ ok: false, error: "Esa reserva no existe." }, { status: 404 });
  }

  /*
   * Nunca antes de que pase la hora de la cita: hasta ese momento la clienta
   * todavía puede presentarse, y un cobro adelantado sería injustificable.
   */
  if (hoursUntil(booking.date, booking.start_time) > 0) {
    return NextResponse.json(
      { ok: false, error: "La cita todavía no ha pasado." },
      { status: 400 },
    );
  }

  /*
   * El importe se calcula aquí con el precio guardado en la reserva, no con lo
   * que mande el navegador: es dinero real de una tarjeta ajena.
   */
  const percent = Math.min(100, Math.max(0, siteConfig.noShow.chargePercent));
  const amount = Math.round((booking.price_cents * percent) / 100) - booking.deposit_cents;

  if (amount <= 0) {
    return NextResponse.json(
      { ok: false, error: "Con la señal ya cobrada no queda nada que cobrar." },
      { status: 400 },
    );
  }

  const result = await chargeNoShow(booking, amount);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, needsAuthentication: result.needsAuthentication },
      { status: 400 },
    );
  }

  await markNoShowCharged(code, amount, result.ref);
  if (booking.status !== "cancelled") await updateBookingStatus(code, "cancelled");

  return NextResponse.json({ ok: true, amount });
}
