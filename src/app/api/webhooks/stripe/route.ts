import { NextResponse, type NextRequest } from "next/server";
import { confirmDeposit } from "@/lib/bookings";

export const runtime = "nodejs";

/**
 * POST /api/webhooks/stripe
 *
 * Confirma la reserva aunque la clienta cierre el navegador tras pagar.
 * Requiere STRIPE_WEBHOOK_SECRET; si no está, el webhook se ignora (la
 * confirmación sigue funcionando por la URL de retorno verificada).
 */
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!secret || !key) {
    return NextResponse.json({ ignored: "webhook no configurado" }, { status: 200 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Falta la firma." }, { status: 400 });

  const raw = await request.text();

  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(key);
    // constructEvent valida la firma: sin esto cualquiera podría marcar reservas como pagadas.
    const event = await stripe.webhooks.constructEventAsync(raw, signature, secret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const code = session.metadata?.booking_code;
      if (code && session.payment_status === "paid") {
        await confirmDeposit(code, `stripe:${session.id}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[webhook] Firma no válida o error: ${message}`);
    return NextResponse.json({ error: "Firma no válida." }, { status: 400 });
  }
}
