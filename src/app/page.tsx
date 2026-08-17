import Image from "next/image";
import Link from "next/link";
import siteConfig from "@config";
import { NailFan, NailSwatch, finishLabel, type Finish } from "@/components/NailArt";
import { ServiceMenu } from "@/components/ServiceMenu";
import { formatDayHours } from "@/components/hours-text";
import { nextAvailableDays } from "@/lib/availability";
import { formatDateLong } from "@/lib/time";

export const dynamic = "force-dynamic";

const { business, content, booking, deposit } = siteConfig;

const FINISHES: Finish[] = [
  "aura",
  "cromado",
  "francesa",
  "animal",
  "babyboomer",
  "gatuna",
  "glitter",
  "nude",
];

export default async function HomePage() {
  // Duración media para sugerir los próximos huecos reales de la agenda.
  // Si la base de datos aún no está configurada (por ejemplo en el primer
  // despliegue), la portada se muestra igual: solo se omite esta línea.
  let upcoming: Awaited<ReturnType<typeof nextAvailableDays>> = [];
  try {
    upcoming = await nextAvailableDays(90, 3);
  } catch (error) {
    console.error("[portada] No se pudo consultar la agenda:", error);
  }

  const hours = formatDayHours();

  return (
    <>
      {/* ---------------------------------------------------------------- HERO */}
      <section className="section grid items-center gap-10 pb-14 pt-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-20 lg:pt-16">
        <div className="animate-rise">
          <p className="eyebrow">{business.address.area}</p>
          <h1 className="mt-3 text-[clamp(2.4rem,6vw,4.1rem)] leading-[1.05]">
            {business.tagline}
          </h1>
          <p className="mt-5 max-w-md text-[16px] leading-relaxed text-muted">{business.intro}</p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/reservar" className="btn-primary">
              Ver huecos libres
            </Link>
            <Link href="#servicios" className="btn-ghost">
              Servicios y precios
            </Link>
          </div>

          {upcoming.length > 0 && (
            <p className="mt-5 text-[13px] text-muted">
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-green-500 align-middle" />
              Próximo hueco: <strong className="font-semibold text-ink">
                {formatDateLong(upcoming[0].date)}
              </strong>{" "}
              a las {upcoming[0].slots[0].start}
            </p>
          )}

          <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-line pt-6">
            {[
              { term: "Cita", desc: "individual" },
              { term: "Reserva", desc: "online 24 h" },
              { term: "Aviso", desc: "el día antes" },
            ].map((item) => (
              <div key={item.term}>
                <dt className="eyebrow">{item.term}</dt>
                <dd className="mt-1 text-[14px] text-ink">{item.desc}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative">
          <div className="absolute inset-0 -z-10 rounded-[3rem] bg-gradient-to-br from-accent/25 via-transparent to-primary/10 blur-2xl" />
          {siteConfig.gallery.length > 0 ? (
            <div className="card relative aspect-[4/5] overflow-hidden shadow-sm sm:aspect-[5/6]">
              <Image
                src={siteConfig.gallery[0].src}
                alt={siteConfig.gallery[0].alt}
                fill
                // Es la imagen grande de la portada: se carga con prioridad
                // para que no aparezca en blanco al abrir la web.
                priority
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="card overflow-hidden p-6 shadow-sm sm:p-10">
              <NailFan className="w-full" />
              <p className="mt-2 text-center text-[13px] italic text-muted">
                Acrílicas, semipermanente y retiradas cuidadas
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ----------------------------------------------------------- SERVICIOS */}
      <section id="servicios" className="section scroll-mt-24 py-14 lg:py-20">
        <header className="mb-8 max-w-2xl">
          <p className="eyebrow">Carta</p>
          <h2 className="mt-2 text-[clamp(1.9rem,4vw,2.75rem)]">Servicios y precios</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            Los precios marcados con «desde» dependen de cuántas uñas se decoren y del detalle del
            diseño. Si mandas la referencia antes de la cita, se confirma el precio exacto.
          </p>
        </header>
        <ServiceMenu />
      </section>

      {/* ------------------------------------------------------ CÓMO FUNCIONA */}
      <section id="como-funciona" className="scroll-mt-24 border-y border-line bg-surface py-14 lg:py-20">
        <div className="section">
          <header className="mb-10 max-w-2xl">
            <p className="eyebrow">Reservar es fácil</p>
            <h2 className="mt-2 text-[clamp(1.9rem,4vw,2.75rem)]">Cómo funciona</h2>
          </header>

          <ol className="grid gap-8 sm:grid-cols-3">
            {content.steps.map((step, index) => (
              <li key={step.title}>
                <span className="font-display text-[2.6rem] leading-none text-accent">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-[19px]">{step.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">{step.text}</p>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-line bg-bg px-5 py-4 text-[13px] text-muted">
            <span>
              Antelación mínima: <strong className="text-ink">{booking.minNoticeHours} h</strong>
            </span>
            <span>
              Cancelación gratis hasta{" "}
              <strong className="text-ink">{booking.cancellationHours} h</strong> antes
            </span>
            {deposit.enabled && (
              <span>
                Señal de{" "}
                <strong className="text-ink">
                  {deposit.mode === "fixed" ? `${deposit.amount} €` : `${deposit.amount} %`}
                </strong>{" "}
                al reservar
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ TRABAJOS */}
      <section id="trabajos" className="section scroll-mt-24 py-14 lg:py-20">
        <header className="mb-8 max-w-2xl">
          <p className="eyebrow">Galería</p>
          <h2 className="mt-2 text-[clamp(1.9rem,4vw,2.75rem)]">Acabados que puedes pedir</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            Una muestra de las técnicas más pedidas. Si traes una referencia distinta, la vemos y te
            digo si es viable con la longitud que llevas.
          </p>
        </header>

        {siteConfig.gallery.length > 0 ? (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {siteConfig.gallery.map((photo) => (
              <li
                key={photo.src}
                className="card group relative aspect-[4/5] overflow-hidden transition-shadow hover:shadow-md"
              >
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  sizes="(max-width: 640px) 50vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </li>
            ))}
          </ul>
        ) : (
          /* Sin fotos todavía: uñas dibujadas para que la sección no quede vacía. */
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {FINISHES.map((finish) => (
              <li
                key={finish}
                className="card group overflow-hidden p-5 transition-shadow hover:shadow-md"
              >
                <NailSwatch
                  finish={finish}
                  className="mx-auto h-32 w-auto transition-transform duration-300 group-hover:-translate-y-1"
                />
                <p className="mt-4 text-center text-[13px] font-medium text-ink">
                  {finishLabel(finish)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* -------------------------------------------------------------- SOBRE */}
      <section className="border-y border-line bg-surface py-14 lg:py-20">
        <div className="section grid gap-10 lg:grid-cols-[1fr_0.85fr] lg:gap-16">
          <div>
            <p className="eyebrow">{business.ownerName || "El estudio"}</p>
            <h2 className="mt-2 text-[clamp(1.9rem,4vw,2.75rem)]">{content.about.title}</h2>
            {content.about.body.map((paragraph) => (
              <p key={paragraph.slice(0, 24)} className="mt-4 text-[15px] leading-relaxed text-muted">
                {paragraph}
              </p>
            ))}
            <ul className="mt-6 flex flex-wrap gap-2">
              {content.about.badges.map((badge) => (
                <li
                  key={badge}
                  className="rounded-full border border-line px-3 py-1.5 text-[12px] text-muted"
                >
                  {badge}
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-6">
            <p className="eyebrow">Horario del estudio</p>
            <ul className="mt-3 divide-y divide-line">
              {hours.map((row) => (
                <li key={row.label} className="flex items-baseline justify-between gap-4 py-2.5">
                  <span className={`text-[14px] ${row.closed ? "text-muted/60" : "text-ink"}`}>
                    {row.label}
                  </span>
                  <span
                    className={`text-right text-[13px] ${row.closed ? "text-muted/60" : "text-muted"}`}
                  >
                    {row.hours}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-line pt-4 text-[13px] leading-relaxed text-muted">
              {business.address.note}
            </p>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- OPINIONES */}
      {content.testimonials.length > 0 && (
      <section className="section py-14 lg:py-20">
        <header className="mb-8 max-w-2xl">
          <p className="eyebrow">Clientas</p>
          <h2 className="mt-2 text-[clamp(1.9rem,4vw,2.75rem)]">Lo que dicen</h2>
        </header>

        <ul className="grid gap-5 md:grid-cols-3">
          {content.testimonials.map((testimonial) => (
            <li key={testimonial.name} className="card flex flex-col p-6">
              <p className="font-display text-3xl leading-none text-accent">&ldquo;</p>
              <p className="mt-2 flex-1 text-[15px] leading-relaxed text-ink">{testimonial.text}</p>
              <footer className="mt-5 border-t border-line pt-3">
                <p className="text-[14px] font-semibold text-ink">{testimonial.name}</p>
                <p className="text-[12px] text-muted">{testimonial.service}</p>
              </footer>
            </li>
          ))}
        </ul>
      </section>
      )}

      {/* --------------------------------------------------------------- DUDAS */}
      <section id="dudas" className="section scroll-mt-24 py-14 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <header>
            <p className="eyebrow">Preguntas</p>
            <h2 className="mt-2 text-[clamp(1.9rem,4vw,2.75rem)]">Dudas frecuentes</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              {business.whatsapp
                ? "Si te queda alguna, escríbeme por WhatsApp y te contesto yo misma."
                : "Si te queda alguna, puedes indicármela en la nota al reservar y la vemos antes de la cita."}
            </p>
            {business.whatsapp && (
              <a
                href={`https://wa.me/${business.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost btn-sm mt-5"
              >
                Preguntar por WhatsApp
              </a>
            )}
          </header>

          <ul className="divide-y divide-line border-t border-line">
            {content.faq.map((item) => (
              <li key={item.q}>
                <details className="group py-4">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[16px] font-medium text-ink marker:hidden">
                    {item.q}
                    <span className="mt-1 shrink-0 text-muted transition-transform duration-200 group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-2 pr-8 text-[14px] leading-relaxed text-muted">{item.a}</p>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ----------------------------------------------------------- CTA FINAL */}
      <section className="section pb-20">
        <div className="relative overflow-hidden rounded-3xl border border-line bg-surface px-6 py-14 text-center sm:px-12">
          <div className="absolute inset-x-0 -top-24 -z-0 h-48 bg-gradient-to-b from-accent/25 to-transparent blur-2xl" />
          <div className="relative">
            <h2 className="text-[clamp(1.8rem,4vw,2.6rem)]">¿Nos vemos?</h2>
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted">
              Elige tu servicio y quédate con el hueco que mejor te venga. Recibirás la confirmación
              al instante y un recordatorio el día antes.
            </p>
            <Link href="/reservar" className="btn-primary mt-7">
              Reservar mi cita
            </Link>
          </div>
        </div>
      </section>

      {/* Barra fija de reserva en móvil */}
      <div className="sticky bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur-md md:hidden">
        <Link href="/reservar" className="btn-primary w-full">
          Reservar cita
        </Link>
      </div>
    </>
  );
}
