import { NextResponse, type NextRequest } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import {
  getBooking,
  updateBookingDetails,
  updateBookingStatus,
  type BookingStatus,
} from "@/lib/db";
import { isSlotBookable } from "@/lib/availability";
import { endTime } from "@/lib/time";
import { manageUrl } from "@/lib/urls";
import { bookingMoved, cancellationNotice } from "@/lib/mail/templates";
import { sendAll } from "@/lib/mail/send";

export const runtime = "nodejs";

const ALLOWED: BookingStatus[] = ["confirmed", "cancelled", "completed"];

/**
 * PATCH /api/admin/bookings/AUR-XXXX  body: { status }
 * La profesional cambia el estado de una cita desde el panel. Al cancelar,
 * se avisa a la clienta por email.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const { code } = await params;
  const body = (await request.json().catch(() => ({}))) as { status?: unknown };
  const status = body.status as BookingStatus;

  if (!ALLOWED.includes(status)) {
    return NextResponse.json({ ok: false, error: "Estado no válido." }, { status: 400 });
  }

  const booking = await getBooking(code);
  if (!booking) {
    return NextResponse.json({ ok: false, error: "Reserva no encontrada." }, { status: 404 });
  }
  if (booking.status === status) return NextResponse.json({ ok: true, unchanged: true });

  /*
   * Queda constancia de que canceló ella. Una cita que cancela la profesional
   * no se le cobra a la clienta por tarde que sea, y sin este dato el panel no
   * podía distinguirla de una cancelación tardía de la clienta.
   */
  await updateBookingStatus(code, status, "admin");

  if (status === "cancelled") {
    const updated = (await getBooking(code))!;
    await sendAll([
      {
        to: updated.client_email,
        kind: "cancellation_client",
        bookingCode: code,
        ...cancellationNotice(updated, false),
      },
    ]);
  }

  return NextResponse.json({ ok: true });
}

/**
 * PUT /api/admin/bookings/AUR-XXXX
 * body: { date, time, name, phone, address, notes }
 *
 * Editar una cita desde el panel: moverla de hora o corregir los datos de la
 * clienta. Si cambia el día o la hora, se le avisa por email: se ha organizado
 * alrededor de esa hora y enterarse al llegar sería lo peor que puede pasar.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const { code } = await params;
  const booking = await getBooking(code);
  if (!booking) {
    return NextResponse.json({ ok: false, error: "Reserva no encontrada." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const date = str(body.date) || booking.date;
  const time = str(body.time) || booking.start_time;
  const name = str(body.name);
  const phone = str(body.phone);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return NextResponse.json({ ok: false, error: "Día u hora no válidos." }, { status: 400 });
  }
  if (name.length < 2) {
    return NextResponse.json({ ok: false, error: "Falta el nombre." }, { status: 400 });
  }

  const semueve = date !== booking.date || time !== booking.start_time;

  /*
   * Al mover la cita hay que comprobar que el hueco nuevo esté libre, pero
   * ignorando ESTA cita: si no, chocaría con su propio sitio en la agenda.
   */
  if (semueve) {
    const libre = await isSlotBookable(date, time, booking.duration_min, code);
    if (!libre.ok) {
      return NextResponse.json({ ok: false, error: libre.reason }, { status: 409 });
    }
  }

  const antes = { date: booking.date, start_time: booking.start_time };

  await updateBookingDetails(code, {
    date,
    start_time: time,
    end_time: endTime(time, booking.duration_min),
    client_name: name,
    client_phone: phone,
    client_address: str(body.address).slice(0, 300),
    notes: str(body.notes).slice(0, 800),
  });

  const actualizada = (await getBooking(code))!;

  if (semueve && actualizada.status !== "cancelled") {
    await sendAll([
      {
        to: actualizada.client_email,
        kind: "booking_moved",
        bookingCode: code,
        ...bookingMoved(actualizada, antes, manageUrl(code, actualizada.manage_token)),
      },
    ]);
  }

  return NextResponse.json({ ok: true, avisada: semueve });
}
