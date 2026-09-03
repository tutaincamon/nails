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

/**
 * Abre la pantalla de Stripe. Hace una de dos cosas según cómo esté configurado
 * el negocio, y la diferencia importa mucho para la clienta:
 *
 *   CON SEÑAL      Se le cobra el importe de la señal. Si además hay política
 *                  de plantones, esa misma tarjeta queda guardada.
 *   SIN SEÑAL      No se le cobra NADA. Solo se registra la tarjeta para poder
 *                  cobrarle si no acude. Reservar sale gratis.
 */
export async function createCheckout(booking: BookingRow): Promise<CheckoutResult> {
  if (!isStripeConfigured()) return { mode: "demo" };

  const cobraSenal = booking.deposit_cents > 0;
  const guardaTarjeta = siteConfig.noShow.enabled;
  if (!cobraSenal && !guardaTarjeta) return { mode: "demo" };

  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(env("STRIPE_SECRET_KEY")!);

    const base = baseUrl();
    const comun = {
      customer_email: booking.client_email,
      // El código va en metadata para poder confirmar la reserva desde el webhook.
      metadata: { booking_code: booking.code },
      success_url: `${base}/reserva/${booking.code}?t=${booking.manage_token}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/pago/${booking.code}?t=${booking.manage_token}&cancelado=1`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    };

    const session = cobraSenal
      ? await stripe.checkout.sessions.create({
          ...comun,
          mode: "payment",
          ...(guardaTarjeta
            ? {
                customer_creation: "always" as const,
                payment_intent_data: { setup_future_usage: "off_session" as const },
              }
            : {}),
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
        })
      : /*
         * Modo "setup": Stripe pide la tarjeta y la valida con el banco, pero no
         * mueve un euro. Es lo que permite que reservar sea gratis y aun así
         * poder cobrar un plantón después.
         */
        await stripe.checkout.sessions.create({
          ...comun,
          mode: "setup",
          currency: siteConfig.business.currency.toLowerCase(),
          /*
           * Sin esto la tarjeta se queda sin dueño y no sirve para nada.
           *
           * customer_creation va por defecto en "if_required", y en modo setup
           * Stripe no requiere cliente: la sesión terminaba con customer a
           * null, y al no haber cliente no se podía guardar la tarjeta ni
           * cobrar nada después. Es decir, se le pedía la tarjeta a la clienta,
           * ella la autorizaba con su banco, y el panel seguía diciendo "sin
           * tarjeta guardada". La política de plantones no existía en la
           * práctica.
           */
          customer_creation: "always",
        });

    if (!session.url) return { mode: "error", error: "Stripe no devolvió una URL." };
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
): Promise<{ paid: boolean; ref?: string; card?: SavedCard }> {
  if (!isStripeConfigured()) return { paid: false };

  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(env("STRIPE_SECRET_KEY")!);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.metadata?.booking_code !== bookingCode) return { paid: false };

    /*
     * Dos formas de estar "en regla" según lo que se le pidiera:
     *   · Con señal: tiene que estar pagada.
     *   · Sin señal (solo tarjeta): basta con que completara la pantalla; ahí
     *     no hay pago que comprobar porque no se le cobró nada.
     */
    const conSenal = session.mode === "payment";
    const correcta = conSenal ? session.payment_status === "paid" : session.status === "complete";
    if (!correcta) return { paid: false };

    const card = siteConfig.noShow.enabled
      ? await cardFromSession(stripe, session)
      : undefined;

    return { paid: true, ref: `stripe:${session.id}`, card };
  } catch (err) {
    console.error(`[pago] No se pudo verificar la sesión: ${String(err)}`);
    return { paid: false };
  }
}

/* -------------------------------------------------------------------------- */
/*  Tarjeta guardada y cobro de plantones                                     */
/* -------------------------------------------------------------------------- */

export type SavedCard = {
  customerId: string;
  paymentMethodId: string;
  /** Legible para el panel: "visa ···· 4242". Nunca el número entero. */
  label: string;
};

type StripeLike = import("stripe").Stripe;

/** Saca de la sesión la tarjeta que quedó guardada para futuros cobros. */
async function cardFromSession(
  stripe: StripeLike,
  session: import("stripe").Stripe.Checkout.Session,
): Promise<SavedCard | undefined> {
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (!customerId) return undefined;

  /*
   * La tarjeta cuelga de sitios distintos según cómo se abriera la pantalla:
   * de un cobro (payment_intent) o de un registro sin cobro (setup_intent).
   */
  const method = session.payment_intent
    ? (
        await stripe.paymentIntents.retrieve(
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent.id,
          { expand: ["payment_method"] },
        )
      ).payment_method
    : session.setup_intent
      ? (
          await stripe.setupIntents.retrieve(
            typeof session.setup_intent === "string"
              ? session.setup_intent
              : session.setup_intent.id,
            { expand: ["payment_method"] },
          )
        ).payment_method
      : null;

  if (!method || typeof method === "string") return undefined;
  if (method.type !== "card" || !method.card) return undefined;

  return {
    customerId,
    paymentMethodId: method.id,
    label: `${method.card.brand} ···· ${method.card.last4}`,
  };
}

/**
 * Suelta una tarjeta en Stripe para que deje de poder usarse.
 *
 * Borrar la referencia de nuestra base de datos no basta: mientras siga
 * asociada en Stripe, sigue existiendo una tarjeta suya guardada en un sitio.
 * Si esto falla, el borrado local se hace igual —la clienta ha pedido que se
 * olviden sus datos y eso no puede depender de que un tercero responda—, pero
 * se deja constancia en el registro.
 */
export async function detachCard(paymentMethodId: string): Promise<boolean> {
  if (!isStripeConfigured() || !paymentMethodId) return false;
  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(env("STRIPE_SECRET_KEY")!);
    await stripe.paymentMethods.detach(paymentMethodId);
    return true;
  } catch (err) {
    console.error(`[tarjeta] No se pudo soltar en Stripe: ${String(err)}`);
    return false;
  }
}

export type NoShowChargeResult =
  | { ok: true; ref: string }
  | { ok: false; error: string; needsAuthentication?: boolean };

/**
 * Cobra a una clienta que no apareció, con la tarjeta que dejó al reservar.
 *
 * Ojo con `needsAuthentication`: en Europa el banco puede exigir que la clienta
 * confirme el pago, y sin ella delante eso no se puede hacer. Es un fallo
 * normal y previsto, no un error del sistema: entonces hay que reclamarle por
 * otra vía. Por eso esto disuade, pero no garantiza el cobro.
 */
export async function chargeNoShow(
  booking: BookingRow,
  amountCents: number,
): Promise<NoShowChargeResult> {
  /*
   * Primero lo que tiene que ver con esta reserva y después lo de la
   * configuración: si falta el consentimiento, eso es lo que ella necesita
   * leer, no un aviso de que falta una clave de Stripe.
   */
  if (booking.no_show_cents > 0) {
    return { ok: false, error: "Ya se cobró el plantón de esta reserva." };
  }
  if (!booking.policy_accepted_at) {
    return {
      ok: false,
      error: "No consta que aceptara la política de cancelación, así que no se puede cobrar.",
    };
  }
  if (!booking.card_payment_method || !booking.stripe_customer_id) {
    return { ok: false, error: "Esta reserva no tiene ninguna tarjeta guardada." };
  }
  if (amountCents <= 0) {
    return { ok: false, error: "El importe a cobrar tiene que ser mayor que cero." };
  }
  if (!isStripeConfigured()) {
    return { ok: false, error: "Stripe no está configurado en este despliegue." };
  }

  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(env("STRIPE_SECRET_KEY")!);

    const intent = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: siteConfig.business.currency.toLowerCase(),
        customer: booking.stripe_customer_id,
        payment_method: booking.card_payment_method,
        off_session: true,
        confirm: true,
        description: `Cita no atendida · ${booking.service_name} · ${booking.date} ${booking.start_time}`,
        metadata: { booking_code: booking.code, kind: "no_show" },
      },
      // Si se pulsa dos veces el botón, Stripe cobra una sola vez.
      { idempotencyKey: `no-show-${booking.code}` },
    );

    if (intent.status !== "succeeded") {
      return { ok: false, error: `Stripe devolvió el estado "${intent.status}".` };
    }
    return { ok: true, ref: `stripe:${intent.id}` };
  } catch (err) {
    const error = err as { code?: string; message?: string };
    if (error.code === "authentication_required") {
      return {
        ok: false,
        needsAuthentication: true,
        error:
          "El banco de la clienta pide que confirme ella el pago, y no se puede hacer sin ella delante. Habrá que reclamárselo por otra vía.",
      };
    }
    const message = error.message ?? String(err);
    console.error(`[plantón] No se pudo cobrar: ${message}`);
    return { ok: false, error: message };
  }
}
