import siteConfig from "@config";
import type { BookingRow } from "@/lib/db";
import { baseUrl } from "@/lib/urls";
import { env } from "@/lib/env";

/*
 * Cobro de la señal, con dos modos:
 *
 *   REAL   Si existe STRIPE_SECRET_KEY se crea una sesión de Stripe Checkout.
 *          Con una clave de test (sk_test_...) se cobra con tarjetas de prueba,
 *          sin mover dinero real.
 *   DEMO   Si no hay clave, se usa una pantalla de pago simulado que no pide
 *          ni procesa datos de tarjeta: solo permite simular pago correcto o
 *          rechazado para poder probar el flujo entero.
 */

export function isStripeConfigured(): boolean {
  return Boolean(env("STRIPE_SECRET_KEY"));
}

export type CheckoutResult =
  | { mode: "stripe"; url: string }
  | { mode: "demo" }
  | { mode: "error"; error: string };

export async function createCheckout(booking: BookingRow): Promise<CheckoutResult> {
  if (!isStripeConfigured()) return { mode: "demo" };

  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(env("STRIPE_SECRET_KEY")!);

    const base = baseUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: booking.client_email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: siteConfig.business.currency.toLowerCase(),
            unit_amount: booking.deposit_cents,
            product_data: {
              name: `Señal · ${booking.service_name}`,
              description: `${siteConfig.business.name} · ${booking.date} a las ${booking.start_time}`,
            },
          },
        },
      ],
      // El código va en metadata para poder confirmar la reserva desde el webhook.
      metadata: { booking_code: booking.code },
      success_url: `${base}/reserva/${booking.code}?t=${booking.manage_token}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/pago/${booking.code}?t=${booking.manage_token}&cancelado=1`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    });

    if (!session.url) return { mode: "error", error: "Stripe no devolvió una URL de pago." };
    return { mode: "stripe", url: session.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[pago] No se pudo crear la sesión de Stripe: ${message}`);
    return { mode: "error", error: message };
  }
}

/**
 * Comprueba en Stripe que una sesión está realmente pagada y corresponde a esta
 * reserva. Nunca se confía en los parámetros de la URL de vuelta.
 */
export async function verifyStripeSession(
  sessionId: string,
  bookingCode: string,
): Promise<{ paid: boolean; ref?: string }> {
  if (!isStripeConfigured()) return { paid: false };

  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(env("STRIPE_SECRET_KEY")!);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.metadata?.booking_code !== bookingCode) return { paid: false };
    if (session.payment_status !== "paid") return { paid: false };

    return { paid: true, ref: `stripe:${session.id}` };
  } catch (err) {
    console.error(`[pago] No se pudo verificar la sesión: ${String(err)}`);
    return { paid: false };
  }
}
