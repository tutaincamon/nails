import type { Metadata } from "next";
import Link from "next/link";
import siteConfig from "@config";
import { leerTestigo } from "@/lib/client-portal";
import { puedeBorrar } from "@/lib/client-data";
import { MisDatos } from "@/components/MisDatos";
import { SalirDispositivo } from "@/components/SalirDispositivo";
import { bookingsForEmail, type BookingRow } from "@/lib/db";
import { StatusBadge, capitalize } from "@/components/BookingDetails";
import { formatCents } from "@/lib/money";
import { cobradoCents } from "@/lib/price";
import { formatDateLong, formatDuration, hoursUntil } from "@/lib/time";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mis citas",
  robots: { index: false, follow: false },
};

export default async function MisCitasToken({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const leido = leerTestigo(decodeURIComponent(token));

  if (!leido.ok) {
    return (
      <Marco titulo={leido.motivo === "caducado" ? "El enlace ha caducado" : "Enlace no válido"}>
        <p className="text-[15px] leading-relaxed text-muted">
          {leido.motivo === "caducado"
            ? "Los enlaces duran 72 horas por seguridad. Pide uno nuevo y te llega al momento."
            : "Puede que el enlace se haya cortado al copiarlo. Pide uno nuevo desde aquí."}
        </p>
        <Link href="/mis-citas" className="btn-primary mt-6">
          Pedir un enlace nuevo
        </Link>
      </Marco>
    );
  }

  const citas = await bookingsForEmail(leido.email);
  const bloqueo = await puedeBorrar(leido.email);
  const ahora = citas.filter((c) => c.status !== "cancelled" && hoursUntil(c.date, c.start_time) >= 0);
  const antes = citas.filter((c) => !ahora.includes(c));

  return (
    <Marco titulo={ahora.length > 0 ? "Tus próximas citas" : "Tus citas"}>
      {citas.length === 0 && (
        <p className="text-[15px] leading-relaxed text-muted">
          No encuentro citas con este email.
        </p>
      )}

      {ahora.length > 0 && (
        <ul className="space-y-4">
          {ahora.map((cita) => (
            <Ficha key={cita.code} cita={cita} proxima />
          ))}
        </ul>
      )}

      {ahora.length === 0 && citas.length > 0 && (
        <p className="text-[15px] leading-relaxed text-muted">
          Ahora mismo no tienes ninguna cita por delante.
        </p>
      )}

      <Link href="/reservar" className="btn-primary mt-8">
        Reservar otra cita
      </Link>

      {antes.length > 0 && (
        <section className="mt-12">
          <h2 className="text-[19px]">Historial</h2>
          <ul className="mt-4 space-y-3">
            {antes.map((cita) => (
              <Ficha key={cita.code} cita={cita} />
            ))}
          </ul>
        </section>
      )}

      {citas.length > 0 && (
        <MisDatos
          testigo={token}
          tieneTarjeta={citas.some((c) => Boolean(c.card_payment_method))}
          bloqueo={bloqueo}
        />
      )}
    </Marco>
  );
}

function Ficha({ cita, proxima = false }: { cita: BookingRow; proxima?: boolean }) {
  const puedeCancelar =
    cita.status !== "cancelled" &&
    hoursUntil(cita.date, cita.start_time) >= siteConfig.booking.cancellationHours;

  return (
    <li className={`border border-line p-5 ${proxima ? "bg-surface" : "bg-transparent"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold text-ink">
            {capitalize(formatDateLong(cita.date))} · {cita.start_time}
          </p>
          <p className="mt-0.5 text-[13.5px] text-muted">
            {cita.service_name} · {formatDuration(cita.duration_min)} ·{" "}
            {formatCents(cobradoCents(cita))}
          </p>
        </div>
        <StatusBadge status={cita.status} />
      </div>

      {proxima && cita.status !== "cancelled" && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href={`/reserva/${cita.code}?t=${cita.manage_token}`}
            className="btn-ghost btn-sm"
          >
            {puedeCancelar ? "Ver o cancelar" : "Ver la cita"}
          </Link>
          {/*
            Aquí no se cancela directamente: se manda a la ficha de la cita, que
            es donde está el aviso de lo que cuesta cancelar tarde. Poner un
            botón de cancelar en una lista invita a pulsarlo sin leer nada.
          */}
          {!puedeCancelar && siteConfig.noShow.enabled && (
            <span className="text-[12.5px] text-amber-700">
              Ya no se puede cancelar sin coste
            </span>
          )}
        </div>
      )}
    </li>
  );
}

function Marco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <>
      <div className="border-b border-line bg-surface">
        <div className="section flex flex-wrap items-end justify-between gap-4 py-10">
          <div>
            <p className="eyebrow">Mis citas</p>
            <h1 className="mt-2 text-[clamp(2rem,5vw,3rem)]">{titulo}</h1>
          </div>
          <SalirDispositivo />
        </div>
      </div>
      <div className="section max-w-2xl py-10 lg:py-14">{children}</div>
    </>
  );
}
