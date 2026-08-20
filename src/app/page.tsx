import Image from "next/image";
import Link from "next/link";
import siteConfig from "@config";
import { PreviewNote } from "@/components/PreviewNote";
import { Reveal } from "@/components/Reveal";
import { ServiceMenu } from "@/components/ServiceMenu";
import { formatDayHours } from "@/components/hours-text";
import { nextAvailableDays } from "@/lib/availability";
import { formatDateLong } from "@/lib/time";

export const dynamic = "force-dynamic";

const { business, content, booking, deposit } = siteConfig;

export default async function HomePage() {
  // Si la base de datos no responde, la portada se muestra igual y solo se
  // omite la línea del próximo hueco.
  let upcoming: Awaited<ReturnType<typeof nextAvailableDays>> = [];
  try {
    upcoming = await nextAvailableDays(90, 1);
  } catch (error) {
    console.error("[portada] No se pudo consultar la agenda:", error);
  }

  const hours = formatDayHours();
  const gallery = siteConfig.gallery;
  const hero = gallery[0] ?? null;
  // Con solo tres fotos merece la pena darles una fila entera para ellas.
  const trio = gallery.length === 3;

  return (
    <>
      {/* ---------------------------------------------------------------- HERO */}
      <section className="relative flex h-[86vh] min-h-[540px] w-full items-end overflow-hidden">
        {hero ? (
          <Image src={hero.src} alt={hero.alt} fill priority sizes="100vw" className="object-cover" />
        ) : (
          <div className="absolute inset-0 bg-ink" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20" />

        <div className="section relative pb-12 lg:pb-16">
          <h1 className="display max-w-[14ch] text-white">{business.tagline}</h1>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/reservar" className="btn-primary btn-light">
              Reservar cita
            </Link>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/85">
              Tres pasos · Confirmación al instante
            </p>
          </div>

          {upcoming.length > 0 && (
            <p className="mt-5 text-[12px] text-white/70">
              Próximo hueco libre: {formatDateLong(upcoming[0].date)} a las{" "}
              {upcoming[0].slots[0].start}
            </p>
          )}
        </div>
      </section>

      {/* ----------------------------------------------------------- SERVICIOS */}
      <section id="servicios" className="section scroll-mt-20 py-20 lg:py-28">
        <Reveal>
          <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow">Carta</p>
              <h2 className="display-sm mt-3">Servicios y precios</h2>
            </div>
            <p className="max-w-sm text-[14px] leading-relaxed text-muted">
              Los precios «desde» dependen del detalle del diseño. Manda la referencia antes de la
              cita y se confirma el precio exacto.
            </p>
          </header>
        </Reveal>
        <Reveal delay={80}>
          <PreviewNote className="mb-6" />
          <ServiceMenu />
        </Reveal>
      </section>

      {/* ------------------------------------------------------------ TRABAJOS */}
      <section id="trabajos" className="scroll-mt-20 border-t border-line py-20 lg:py-28">
        <div className="section">
          <Reveal>
            <header className="mb-14">
              <p className="eyebrow">Galería</p>
              <h2 className="display-sm mt-3 max-w-[14ch]">Trabajos recientes</h2>
            </header>
          </Reveal>

          {/*
            La rejilla se adapta al número de fotos. Con tres van en fila y
            mandan todas por igual; con más, dos columnas y una de cada dos
            baja un poco, que es lo que evita el aspecto de catálogo.
          */}
          <div
            className={
              trio
                ? "grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-3 lg:gap-x-10"
                : "grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:gap-x-16 lg:gap-y-20"
            }
          >
            {gallery.map((photo, index) => {
              const baja = trio ? index === 1 : index % 2 === 1;
              return (
                <Reveal
                  key={photo.src}
                  delay={(index % 3) * 110}
                  className={baja ? (trio ? "sm:mt-14 lg:mt-20" : "sm:mt-24 lg:mt-32") : ""}
                >
                  <figure className="group relative aspect-[3/4] overflow-hidden bg-line/40">
                    <Image
                      src={photo.src}
                      alt={photo.alt}
                      fill
                      sizes={trio ? "(max-width: 640px) 100vw, 31vw" : "(max-width: 640px) 100vw, 45vw"}
                      className="object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04]"
                    />
                  </figure>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- PRÁCTICA */}
      <section id="estudio" className="scroll-mt-20 border-t border-line bg-surface py-20 lg:py-28">
        <div className="section grid gap-14 lg:grid-cols-[1fr_1fr] lg:gap-24">
          <Reveal>
            <p className="eyebrow">El estudio</p>
            <h2 className="display-sm mt-3 max-w-[12ch]">{content.about.title}</h2>
            {content.about.body.map((paragraph) => (
              <p key={paragraph.slice(0, 20)} className="mt-5 max-w-md text-[15px] leading-relaxed text-muted">
                {paragraph}
              </p>
            ))}
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
              {content.about.badges.map((badge) => (
                <li key={badge} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink">
                  {badge}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={100}>
            <p className="eyebrow">Horario</p>
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {hours.map((row) => (
                <li key={row.label} className="flex items-baseline justify-between gap-4 py-3">
                  <span className={`text-[14px] ${row.closed ? "text-muted/50" : "text-ink"}`}>
                    {row.label}
                  </span>
                  <span className={`text-[13px] ${row.closed ? "text-muted/50" : "text-muted"}`}>
                    {row.hours}
                  </span>
                </li>
              ))}
            </ul>

            <dl className="mt-8 space-y-3 text-[13.5px]">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Antelación mínima</dt>
                <dd className="text-ink">{booking.minNoticeHours} h</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Cancelación gratuita</dt>
                <dd className="text-ink">hasta {booking.cancellationHours} h antes</dd>
              </div>
              {deposit.enabled && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Señal al reservar</dt>
                  <dd className="text-ink">
                    {deposit.mode === "fixed" ? `${deposit.amount} €` : `${deposit.amount} %`}
                  </dd>
                </div>
              )}
            </dl>

            <p className="mt-6 text-[13px] leading-relaxed text-muted">{business.address.note}</p>
          </Reveal>
        </div>
      </section>

      {/* --------------------------------------------------------------- DUDAS */}
      <section id="dudas" className="section scroll-mt-20 py-20 lg:py-28">
        <Reveal>
          <p className="eyebrow">Preguntas</p>
          <h2 className="display-sm mt-3 mb-10 max-w-[12ch]">Dudas frecuentes</h2>
        </Reveal>

        <Reveal delay={60}>
          <ul className="divide-y divide-line border-y border-line">
            {content.faq.map((item) => (
              <li key={item.q}>
                <details className="group py-5">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-[16px] font-medium text-ink marker:hidden">
                    {item.q}
                    <span className="mt-1 shrink-0 text-muted transition-transform duration-300 group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-muted">{item.a}</p>
                </details>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      {/* ----------------------------------------------------------- CTA FINAL */}
      <section className="border-t border-line bg-ink py-24 text-center lg:py-32">
        <div className="section">
          <Reveal>
            <h2 className="display-sm mx-auto max-w-[16ch] text-[var(--c-bg)]">
              Elige tu hueco y listo
            </h2>
            <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-[var(--c-bg)]/65">
              Servicio, día y hora. Recibes la confirmación al momento y un recordatorio el día
              antes.
            </p>
            <Link href="/reservar" className="btn-primary btn-light mt-9">
              Reservar cita
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Barra fija de reserva en móvil */}
      <div className="sticky bottom-0 z-30 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur-md md:hidden">
        <Link href="/reservar" className="btn-primary w-full">
          Reservar cita
        </Link>
      </div>
    </>
  );
}
