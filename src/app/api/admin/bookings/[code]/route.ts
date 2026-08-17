import { NextResponse, type NextRequest } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { getBooking, updateBookingStatus, type BookingStatus } from "@/lib/db";
import { cancellationNotice } from "@/lib/mail/templates";
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

  await updateBookingStatus(code, status);

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
