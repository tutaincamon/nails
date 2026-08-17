import { NextResponse, type NextRequest } from "next/server";
import { confirmDeposit } from "@/lib/bookings";
import { getBooking } from "@/lib/db";
import { isStripeConfigured } from "@/lib/payments";

export const runtime = "nodejs";

/**
 * POST /api/demo-pay/AUR-XXXX?t=token   body: { outcome: "success" | "declined" }
 *
 * Pago SIMULADO para el prototipo: no pide ni procesa ningún dato de tarjeta,
 * solo marca la señal como pagada para poder probar el flujo completo.
 * Se desactiva por completo en cuanto hay una clave de Stripe configurada.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  if (isStripeConfigured()) {
    return NextResponse.json(
      { ok: false, error: "El pago simulado está desactivado: hay una pasarela real configurada." },
      { status: 400 },
    );
  }

  const { code } = await params;
  const token = request.nextUrl.searchParams.get("t") ?? "";

  const booking = getBooking(code);
  if (!booking || booking.manage_token !== token) {
    return NextResponse.json({ ok: false, error: "Enlace no válido." }, { status: 404 });
  }
  if (booking.status === "cancelled") {
    return NextResponse.json({ ok: false, error: "Esta reserva está cancelada." }, { status: 400 });
  }

  let outcome = "success";
  try {
    const body = (await request.json()) as { outcome?: unknown };
    if (body.outcome === "declined") outcome = "declined";
  } catch {
    // Sin cuerpo: se asume pago correcto.
  }

  if (outcome === "declined") {
    return NextResponse.json({
      ok: false,
      declined: true,
      error: "Pago rechazado (simulado). Tu hueco sigue guardado: prueba otra vez.",
    });
  }

  const result = await confirmDeposit(code, `demo:${Date.now()}`);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });

  return NextResponse.json({ ok: true, alreadyPaid: result.alreadyPaid });
}
