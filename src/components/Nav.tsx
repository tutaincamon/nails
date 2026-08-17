import Link from "next/link";
import siteConfig from "@config";

const links = [
  { href: "/#servicios", label: "Servicios" },
  { href: "/#como-funciona", label: "Cómo funciona" },
  { href: "/#trabajos", label: "Trabajos" },
  { href: "/#dudas", label: "Dudas" },
];

export function Nav() {
  const { business } = siteConfig;

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/85 backdrop-blur-md">
      <nav className="section flex h-16 items-center justify-between gap-4">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="font-display text-[22px] leading-none text-ink">{business.name}</span>
          <span className="hidden text-[11px] uppercase tracking-[0.16em] text-muted sm:inline">
            uñas
          </span>
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[14px] text-muted transition-colors hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <a
            href={`https://wa.me/${business.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden text-[14px] text-muted transition-colors hover:text-ink sm:inline"
          >
            WhatsApp
          </a>
          <Link href="/reservar" className="btn-primary btn-sm">
            Reservar cita
          </Link>
        </div>
      </nav>
    </header>
  );
}
