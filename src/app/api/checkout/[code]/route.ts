import { NextResponse, type NextRequest } from "next/server";
import siteConfig from "@config";
import { getBooking } from "@/lib/db";
import { createCheckout } from "@/lib/payments";

export const runtime = "nodejs";

/**
 * POST /api/checkout/AUR-XXXX?t=token
 * Crea la sesión de pago de la señal. Si Stripe no está configurado, responde
 * mode:"demo" y la pantalla de pago usa el simulador.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const token = request.nextUrl.searchParams.get("t") ?? "";

  const booking = await getBooking(code);
  if (!booking || booking.manage_token !== token) {
    return NextResponse.json({ ok: false, error: "Enlace no válido." }, { status: 404 });
  }
  if (booking.status === "cancelled") {
    return NextResponse.json({ ok: false, error: "Esta reserva está cancelada." }, { status: 400 });
  }
  if (booking.deposit_status === "paid") {
    return NextResponse.json({ ok: true, mode: "already_paid" });
  }
  /*
   * Sin señal la pantalla sigue haciendo falta si hay que registrar la tarjeta.
   * Solo se sale de aquí cuando no hay ni lo uno ni lo otro.
   */
  const pideTarjeta = siteConfig.noShow.enabled && !booking.card_payment_method;
  if (booking.deposit_cents <= 0 && !pideTarjeta) {
    return NextResponse.json({ ok: true, mode: "not_required" });
  }

  const result = await createCheckout(booking);
  if (result.mode === "error") {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, ...result });
}
