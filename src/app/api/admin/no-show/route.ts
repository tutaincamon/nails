import { NextResponse, type NextRequest } from "next/server";
import siteConfig from "@config";
import { isAdmin } from "@/lib/admin-auth";
import { getBooking, markNoShowCharged, updateBookingStatus } from "@/lib/db";
import { chargeNoShow } from "@/lib/payments";
import { noShowCents } from "@/lib/policy";
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
   * Se puede cobrar en dos situaciones, y solo en esas dos:
   *   · La cita ya pasó y no se presentó.
   *   · La canceló ella misma fuera de plazo, aunque la cita aún no haya
   *     llegado: ahí el hueco ya está perdido y la política se aplica igual.
   *
   * Lo que no se puede es cobrar una cita futura que sigue en pie: hasta la
   * hora, la clienta todavía puede aparecer.
   */
  const quedan = hoursUntil(booking.date, booking.start_time);
  const yaPaso = quedan <= 0;
  const canceladaTarde = booking.status === "cancelled" && quedan < siteConfig.booking.cancellationHours;

  if (!yaPaso && !canceladaTarde) {
    return NextResponse.json(
      { ok: false, error: "La cita todavía no ha pasado y sigue en pie." },
      { status: 400 },
    );
  }

  /*
   * El importe se calcula aquí, con el precio guardado en la reserva y nunca
   * con lo que mande el navegador: es dinero real de una tarjeta ajena.
   */
  const amount = noShowCents(booking);

  if (amount <= 0) {
    return NextResponse.json(
      { ok: false, error: "No queda nada que cobrar en esta reserva." },
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
