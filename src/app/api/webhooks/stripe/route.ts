import { NextResponse, type NextRequest } from "next/server";
import { confirmDeposit } from "@/lib/bookings";
import { verifyStripeSession } from "@/lib/payments";

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
      if (code) {
        /*
         * Se vuelve a pedir la sesión a Stripe en vez de fiarse del objeto del
         * evento: así se recupera también la tarjeta guardada, que el evento no
         * trae expandida. Este es el camino que se usa cuando la clienta cierra
         * el navegador tras pagar y no pasa por la página de vuelta.
         *
         * Quien decide si la sesión está en regla es verifyStripeSession, que
         * conoce los dos modos. Aquí se exigía payment_status === "paid", y eso
         * dejaba fuera justo el caso de esta web cuando no se cobra señal: ahí
         * Stripe solo registra la tarjeta y devuelve "no_payment_required", así
         * que el webhook no hacía nada. Quien cerrase el navegador después de
         * meter la tarjeta se quedaba con la cita sin confirmar y sin tarjeta
         * guardada, que es tanto como no tener política de plantones.
         */
        const verified = await verifyStripeSession(session.id, code);
        if (verified.paid) await confirmDeposit(code, verified.ref!, verified.card);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[webhook] Firma no válida o error: ${message}`);
    return NextResponse.json({ error: "Firma no válida." }, { status: 400 });
  }
}
