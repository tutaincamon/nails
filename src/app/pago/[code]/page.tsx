import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import siteConfig from "@config";
import { BookingDetails } from "@/components/BookingDetails";
import { PaymentPanel } from "@/components/PaymentPanel";
import { getBooking } from "@/lib/db";
import { isStripeConfigured } from "@/lib/payments";
import { formatCents } from "@/lib/money";
import { formatDateLong } from "@/lib/time";
import { noShowCents } from "@/lib/policy";
import { contactSentence } from "@/lib/business";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Pagar la señal", robots: { index: false } };

type Props = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ t?: string; cancelado?: string }>;
};

export default async function PaymentPage({ params, searchParams }: Props) {
  const { code } = await params;
  const { t: token = "", cancelado } = await searchParams;

  const booking = await getBooking(code);
  if (!booking || booking.manage_token !== token) {
    return (
      <div className="section max-w-2xl py-16">
        <h1 className="text-[clamp(1.8rem,5vw,2.5rem)]">Enlace no válido</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Este enlace de pago no corresponde a ninguna reserva. Revisa el email de confirmación o
          {contactSentence()}.
        </p>
        <Link href="/reservar" className="btn-primary mt-6">
          Reservar una cita
        </Link>
      </div>
    );
  }

  const cobraSenal = booking.deposit_cents > 0;
  /*
   * Sin señal, esta pantalla sigue haciendo falta: es donde se registra la
   * tarjeta. Si aquí se redirigiera por no haber importe que cobrar, la cita se
   * quedaría pendiente para siempre y sin tarjeta con la que respaldarla.
   */
  const pideTarjeta = siteConfig.noShow.enabled && !booking.card_payment_method;

  // Ya no hay nada que hacer aquí: a la ficha de la cita.
  if (booking.deposit_status === "paid" || (!cobraSenal && !pideTarjeta)) {
    redirect(`/reserva/${code}?t=${token}`);
  }

  return (
    <div className="section max-w-2xl py-12 lg:py-16">
      <p className="eyebrow">Último paso</p>
      <h1 className="mt-2 text-[clamp(1.9rem,5vw,2.7rem)]">
        {cobraSenal ? `Señal de ${formatCents(booking.deposit_cents)}` : "Confirma tu tarjeta"}
      </h1>
      {!cobraSenal && (
        <p className="mt-3 border border-line bg-surface px-4 py-3 text-[14px] leading-relaxed text-ink">
          <strong>Reservar es gratis y ahora no se te cobra nada.</strong> Solo dejo registrada la
          tarjeta por si no puedes venir: si cancelas con menos de{" "}
          {siteConfig.booking.cancellationHours} h o no acudes, se cobra{" "}
          {formatCents(noShowCents(booking))}.
        </p>
      )}
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        Te tengo guardado el hueco del{" "}
        <strong className="font-semibold text-ink">
          {formatDateLong(booking.date)} a las {booking.start_time}
        </strong>
        . En cuanto {cobraSenal ? "se abone la señal" : "quede registrada la tarjeta"}, la cita
        queda confirmada y te llega el email de confirmación.
        {/*
          Antes decía "el email con la dirección", que solo tiene sentido cuando
          la clienta va al estudio. A domicilio la dirección la pone ella, así
          que prometerle una dirección por email sobra.
        */}
        {!siteConfig.venue.needsClientAddress && " Ahí va también la dirección."}
      </p>

      {cancelado && (
        <p className="mt-6 border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-900">
          Has salido del pago sin completarlo. Tu hueco sigue guardado: puedes pagar la señal ahora.
        </p>
      )}

      <div className="mt-8">
        <PaymentPanel
          code={booking.code}
          token={booking.manage_token}
          amountLabel={formatCents(booking.deposit_cents)}
          stripeReady={isStripeConfigured()}
          soloTarjeta={!cobraSenal}
        />
      </div>

      <div className="card mt-8 px-5 py-1">
        <BookingDetails booking={booking} />
      </div>

      <p className="mt-6 text-[13px] leading-relaxed text-muted">
        {cobraSenal ? (
          <>
            {siteConfig.deposit.note} Si prefieres pagarlo todo {siteConfig.venue.payWhere},{" "}
            {contactSentence()}.
          </>
        ) : (
          <>
            El servicio se paga {siteConfig.venue.payWhere}. Si tienes cualquier duda,{" "}
            {contactSentence()}.
          </>
        )}
      </p>
    </div>
  );
}
