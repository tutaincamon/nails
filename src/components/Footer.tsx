import Link from "next/link";
import siteConfig from "@config";
import { formatDayHours } from "@/components/hours-text";
import { ownerEmail } from "@/lib/business";

export function Footer() {
  const { business } = siteConfig;
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="section grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <p className="font-display text-2xl text-ink">{business.name}</p>
          <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-muted">{business.intro}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={`https://wa.me/${business.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost btn-sm"
            >
              WhatsApp
            </a>
            <a
              href={`https://instagram.com/${business.instagram}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost btn-sm"
            >
              @{business.instagram}
            </a>
          </div>
        </div>

        <div>
          <p className="eyebrow">Horario</p>
          <ul className="mt-3 space-y-1.5 text-[14px] text-muted">
            {formatDayHours().map((row) => (
              <li key={row.label} className="flex justify-between gap-4">
                <span className={row.closed ? "text-muted/60" : ""}>{row.label}</span>
                <span className={row.closed ? "text-muted/60" : "text-ink"}>{row.hours}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="eyebrow">Contacto</p>
          <ul className="mt-3 space-y-1.5 text-[14px] text-muted">
            <li>{business.address.area}</li>
            <li>
              <a href={`tel:${business.phone.replace(/\s/g, "")}`} className="hover:text-ink">
                {business.phone}
              </a>
            </li>
            <li>
              <a href={`mailto:${ownerEmail()}`} className="hover:text-ink">
                {ownerEmail()}
              </a>
            </li>
            <li className="pt-2">
              <Link href="/reservar" className="font-semibold text-primary hover:underline">
                Reservar cita →
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="section flex flex-col gap-2 border-t border-line py-6 text-[12px] text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {year} {business.name}. Todos los derechos reservados.
        </p>
        <p className="text-muted/70">
          Reservas online ·{" "}
          <Link href="/admin" className="hover:text-ink hover:underline">
            Acceso profesional
          </Link>
        </p>
      </div>
    </footer>
  );
}
