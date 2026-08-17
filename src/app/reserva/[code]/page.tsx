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

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Tu cita", robots: { index: false } };

type Props = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ t?: string; session_id?: string }>;
};

export default async function BookingPage({ params, searchParams }: Props) {
  const { code } = await params;
  const { t: token = "", session_id: sessionId } = await searchParams;

  let booking = getBooking(code);

  // Enlace privado: sin el token del email no se muestra nada.
  if (!booking || booking.manage_token !== token) {
    return (
      <Shell title="Enlace no válido">
        <p className="text-[15px] leading-relaxed text-muted">
          Este enlace no corresponde a ninguna cita. Comprueba que lo has copiado completo desde el
          email de confirmación, o escríbeme por WhatsApp al {siteConfig.business.phone} y lo miro.
        </p>
        <Link href="/reservar" className="btn-primary mt-6">
          Reservar una cita
        </Link>
      </Shell>
    );
  }

  // Vuelta de Stripe: se verifica el pago contra Stripe, no por la URL.
  if (sessionId && booking.deposit_status !== "paid") {
    const verified = await verifyStripeSession(sessionId, code);
    if (verified.paid) {
      await confirmDeposit(code, verified.ref!);
      booking = getBooking(code)!;
    }
  }

  const cancellable =
    booking.status !== "cancelled" &&
    hoursUntil(booking.date, booking.start_time) >= siteConfig.booking.cancellationHours;

  const isPast = hoursUntil(booking.date, booking.start_time) < 0;

  return (
    <Shell
      title={
        booking.status === "cancelled"
          ? "Cita cancelada"
          : booking.status === "pending_payment"
            ? "Falta la señal"
            : "¡Cita confirmada!"
      }
      badge={<StatusBadge status={booking.status} />}
      subtitle={
        booking.status === "cancelled"
          ? "Esta cita ya no está en la agenda."
          : booking.status === "pending_payment"
            ? `Te guardo el hueco del ${formatDateLong(booking.date)} a las ${booking.start_time}, pero no queda confirmado hasta que se abone la señal.`
            : `Te espero el ${formatDateLong(booking.date)} a las ${booking.start_time}.`
      }
    >
      {booking.status === "pending_payment" && (
        <Link href={`/pago/${booking.code}?t=${booking.manage_token}`} className="btn-primary mb-6">
          Pagar la señal
        </Link>
      )}

      <div className="card px-5 py-1">
        <BookingDetails booking={booking} />
      </div>

      {booking.status !== "cancelled" && (
        <div className="mt-6 rounded-xl border border-line bg-surface p-5">
          <p className="eyebrow">Cómo llegar</p>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            {siteConfig.business.address.note}
          </p>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">
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
          </p>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {booking.status !== "cancelled" && cancellable && (
          <CancelBooking code={booking.code} token={booking.manage_token} />
        )}

        {booking.status !== "cancelled" && !cancellable && !isPast && (
          <p className="text-[13.5px] leading-relaxed text-muted">
            Ya no se puede cancelar online porque quedan menos de{" "}
            {siteConfig.booking.cancellationHours} h. Si no puedes venir, avísame por WhatsApp cuanto
            antes y lo solucionamos.
          </p>
        )}

        {booking.status === "cancelled" && (
          <Link href="/reservar" className="btn-primary">
            Reservar otra cita
          </Link>
        )}
      </div>

      {!isRealMailConfigured() && (
        <p className="mt-8 rounded-xl border border-dashed border-line bg-bg px-4 py-3 text-[12.5px] leading-relaxed text-muted">
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
