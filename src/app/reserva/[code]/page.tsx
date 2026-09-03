import Link from "next/link";
import type { Metadata } from "next";
import siteConfig from "@config";
import { BookingDetails, StatusBadge } from "@/components/BookingDetails";
import { CancelBooking } from "@/components/CancelBooking";
import { confirmDeposit } from "@/lib/bookings";
import { getBooking } from "@/lib/db";
import { verifyStripeSession } from "@/lib/payments";
import { isRealMailConfigured } from "@/lib/mail/send";
import { formatDateLong, hoursUntil } from "@/lib/time";
import { contactSentence } from "@/lib/business";
import { formatCents } from "@/lib/money";
import { esCancelacionTardia, noShowCents } from "@/lib/policy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Tu cita", robots: { index: false } };

type Props = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ t?: string; session_id?: string }>;
};

export default async function BookingPage({ params, searchParams }: Props) {
  const { code } = await params;
  const { t: token = "", session_id: sessionId } = await searchParams;

  let booking = await getBooking(code);

  // Enlace privado: sin el token del email no se muestra nada.
  if (!booking || booking.manage_token !== token) {
    return (
      <Shell title="Enlace no válido">
        <p className="text-[15px] leading-relaxed text-muted">
          Este enlace no corresponde a ninguna cita. Comprueba que lo has copiado completo desde el
          email de confirmación, o {contactSentence()}.
        </p>
        <Link href="/reservar" className="btn-primary mt-6">
          Reservar una cita
        </Link>
      </Shell>
    );
  }

  /*
   * Vuelta de Stripe: se verifica el pago contra Stripe, no por la URL.
   *
   * Se mira el estado de la cita y no deposit_status porque sin señal esa
   * columna nunca cambia: si el webhook ya confirmó la reserva, preguntar otra
   * vez a Stripe en cada recarga de esta página no aporta nada.
   */
  if (sessionId && booking.status === "pending_payment") {
    const verified = await verifyStripeSession(sessionId, code);
    if (verified.paid) {
      await confirmDeposit(code, verified.ref!, verified.card);
      booking = (await getBooking(code))!;
    }
  }

  const quedan = hoursUntil(booking.date, booking.start_time);
  const isPast = quedan < 0;

  /*
   * Se puede cancelar hasta el momento de la cita. Antes se cerraba la puerta a
   * las 48 h, y lo que conseguía era que quien ya sabía que no iba a ir no
   * avisara: el hueco se perdía igual y nadie se enteraba hasta la hora. Ahora
   * puede avisar siempre, y ve lo que le cuesta antes de pulsar.
   */
  const cancellable = booking.status !== "cancelled" && !isPast;
  const cargoPorCancelar = esCancelacionTardia(quedan) ? noShowCents(booking) : 0;

  return (
    <Shell
      title={
        booking.status === "cancelled"
          ? "Cita cancelada"
          : booking.status === "pending_payment"
            ? (booking.deposit_cents > 0 ? "Falta la señal" : "Falta registrar la tarjeta")
            : "¡Cita confirmada!"
      }
      badge={<StatusBadge status={booking.status} />}
      subtitle={
        booking.status === "cancelled"
          ? "Esta cita ya no está en la agenda."
          : booking.status === "pending_payment"
            ? `Te guardo el hueco del ${formatDateLong(booking.date)} a las ${booking.start_time}, pero no queda confirmado hasta que ${booking.deposit_cents > 0 ? "se abone la señal" : "registres la tarjeta"}.`
            : `Te espero el ${formatDateLong(booking.date)} a las ${booking.start_time}.`
      }
    >
      {booking.status === "pending_payment" && (
        <Link href={`/pago/${booking.code}?t=${booking.manage_token}`} className="btn-primary mb-6">
          {booking.deposit_cents > 0 ? "Pagar la señal" : "Registrar mi tarjeta"}
        </Link>
      )}

      <div className="card px-5 py-1">
        <BookingDetails booking={booking} />
      </div>

      {booking.status !== "cancelled" && (
        <div className="mt-6 border border-line bg-surface p-5">
          {/*
            Cuando es la profesional quien se desplaza, "Cómo llegar" y la frase
            de "dime la dirección al reservar" no pintan nada aquí: la clienta
            ya la ha dado y no tiene que ir a ningún sitio. Lo útil es
            devolvérsela escrita, para que vea si se equivocó al teclearla.
          */}
          {siteConfig.venue.needsClientAddress ? (
            <>
              <p className="eyebrow">Dónde voy</p>
              {booking.client_address ? (
                <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-ink">
                  {booking.client_address}
                </p>
              ) : (
                <p className="mt-2 text-[14px] leading-relaxed text-muted">
                  No consta la dirección. Escríbeme para dármela antes de la cita.
                </p>
              )}
              <p className="mt-2 text-[13px] leading-relaxed text-muted">
                Si algo de la dirección no está bien, dímelo y lo corrijo.
              </p>
            </>
          ) : (
            <>
              <p className="eyebrow">Cómo llegar</p>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">
                {siteConfig.business.address.note}
              </p>
            </>
          )}
          <p className="mt-3 text-[14px] leading-relaxed text-muted">
            {siteConfig.business.whatsapp ? (
              <>
                Si necesitas cambiar la hora, escríbeme por WhatsApp al{" "}
                <a
                  href={`https://wa.me/${siteConfig.business.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-primary hover:underline"
                >
                  {siteConfig.business.phone}
                </a>
                .
              </>
            ) : (
              <>Si necesitas cambiar la hora, {contactSentence()}.</>
            )}
          </p>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {/*
          El aviso va ANTES del botón, no dentro de la confirmación: quien está
          mirando su cita a dos días vista tiene que ver lo que le costaría
          cancelar sin tener que pulsar nada para enterarse.
        */}
        {cancellable && cargoPorCancelar > 0 && (
          <div className="border border-amber-300 bg-amber-50 p-4">
            <p className="text-[14px] font-semibold text-amber-900">
              Cancelar ahora tiene coste
            </p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-amber-900">
              Quedan menos de {siteConfig.booking.cancellationHours} h para la cita, así que
              cancelar o no acudir supone un cargo de{" "}
              <strong>{formatCents(cargoPorCancelar)}</strong> a la tarjeta que dejaste al reservar.
            </p>
          </div>
        )}

        {cancellable && (
          <CancelBooking
            code={booking.code}
            token={booking.manage_token}
            cargoCents={cargoPorCancelar}
          />
        )}

        {booking.status === "cancelled" && (
          <Link href="/reservar" className="btn-primary">
            Reservar otra cita
          </Link>
        )}
      </div>

      {!isRealMailConfigured() && (
        <p className="mt-8 border border-dashed border-line bg-bg px-4 py-3 text-[12.5px] leading-relaxed text-muted">
          <strong className="text-ink">Modo prototipo:</strong> no hay servicio de email
          configurado, así que los correos no salen a internet. Puedes leerlos enteros en{" "}
          <Link href="/admin" className="font-semibold text-primary hover:underline">
            /admin → Emails
          </Link>
          .
        </p>
      )}
    </Shell>
  );
}

function Shell({
  title,
  subtitle,
  badge,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="section max-w-2xl py-12 lg:py-16">
      {badge}
      <h1 className="mt-3 text-[clamp(1.9rem,5vw,2.7rem)]">{title}</h1>
      {subtitle && <p className="mt-3 text-[15px] leading-relaxed text-muted">{subtitle}</p>}
      <div className="mt-8">{children}</div>
    </div>
  );
}
