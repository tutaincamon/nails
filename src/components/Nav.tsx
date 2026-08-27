"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import siteConfig from "@config";

/*
 * `movil` marca los dos únicos que caben junto al botón de reservar sin que la
 * barra se descuadre. En un teléfono no salía ninguno, así que las fotos y sus
 * propias citas quedaban enterradas justo para quien entra desde el móvil.
 *
 * Dos y no más: en 375 px el logotipo y el botón ya se comen media barra. A lo
 * demás se llega bajando por la página.
 */
const links = [
  { href: "/#servicios", label: "Servicios", movil: false },
  { href: "/#trabajos", label: "Trabajos", movil: true },
  // El ancla sigue siendo #estudio: es el id de la sección, no lo que se lee.
  { href: "/#estudio", label: siteConfig.venue.sectionTitle, movil: false },
  // La sección de opiniones solo existe si hay reseñas, así que el enlace también.
  ...(siteConfig.content.testimonials.length > 0
    ? [{ href: "/#opiniones", label: "Opiniones", movil: false }]
    : []),
  { href: "/#dudas", label: "Dudas", movil: false },
  { href: "/mis-citas", label: "Mis citas", movil: true },
];

const enMovil = links.filter((l) => l.movil);

/*
 * En la portada la navegación va superpuesta sobre la foto a sangre, en blanco
 * y sin fondo, y se vuelve sólida al bajar. En el resto de páginas es sólida
 * desde el principio y deja hueco para no taparlas.
 */
export function Nav() {
  const { business } = siteConfig;
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!isHome) return;
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  const overlay = isHome && !scrolled;

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
          overlay ? "bg-transparent" : "border-b border-line bg-bg/95 backdrop-blur-md"
        }`}
      >
        <nav className="section flex h-[72px] items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            {business.logo ? (
              <>
                {/* El logotipo llega en JPG con fondo blanco, así que se recorta
                    en círculo: sobre el fondo hueso un cuadrado blanco cantaría. */}
                <span className="relative block h-11 w-11 overflow-hidden rounded-full bg-white">
                  <Image
                    src={business.logo}
                    alt={business.logoAlt || business.name}
                    fill
                    sizes="44px"
                    className="object-cover"
                    priority
                  />
                </span>
                <span
                  className={`hidden text-[13px] font-bold uppercase tracking-[0.24em] transition-colors sm:inline ${
                    overlay ? "text-white" : "text-ink"
                  }`}
                >
                  {business.name}
                </span>
              </>
            ) : (
              <span
                className={`text-[15px] font-bold uppercase tracking-[0.28em] transition-colors ${
                  overlay ? "text-white" : "text-ink"
                }`}
              >
                {business.name}
              </span>
            )}
          </Link>

          <div className="hidden items-center gap-9 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-[11px] font-semibold uppercase tracking-[0.16em] transition-opacity hover:opacity-60 ${
                  overlay ? "text-white" : "text-ink"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/*
            En móvil estos dos van pegados al botón de reservar, en la misma
            línea, para que la barra siga siendo una sola fila. En escritorio
            no aparecen aquí: ya están en el grupo del centro.
          */}
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="flex items-center gap-4 md:hidden">
              {enMovil.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`whitespace-nowrap text-[10.5px] font-semibold uppercase tracking-[0.1em] transition-opacity hover:opacity-60 ${
                    overlay ? "text-white" : "text-ink"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <Link
              href="/reservar"
              className={`btn-sm whitespace-nowrap ${overlay ? "btn-primary btn-light" : "btn-primary"}`}
            >
              Reservar
            </Link>
          </div>
        </nav>
      </header>

      {/* Fuera de la portada, la barra fija taparía el contenido. */}
      {!isHome && <div className="h-[72px]" aria-hidden="true" />}
    </>
  );
}
