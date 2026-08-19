"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/*
 * Aparición al entrar en pantalla, en tres registros.
 *
 * Usa IntersectionObserver y no las animaciones CSS ligadas al scroll, que son
 * más elegantes pero todavía no funcionan en Firefox. Se dispara una sola vez:
 * que un elemento vuelva a desvanecerse al subir marea.
 *
 * Solo se animan `opacity`, `transform` y `clip-path`, que el navegador puede
 * resolver sin recalcular el diseño de la página. Animar alto o posición daría
 * tirones en el móvil, que es justo donde va a entrar casi todo el mundo.
 *
 * Si el sistema pide menos movimiento, el contenido aparece sin animación.
 */

export type RevealVariant = "fade" | "wipe";

export function Reveal({
  children,
  className = "",
  delay = 0,
  variant = "fade",
}: {
  children: ReactNode;
  className?: string;
  /** Milisegundos de retardo, para escalonar varios elementos seguidos. */
  delay?: number;
  /** "fade" sube y aparece · "wipe" se descubre de abajo arriba. */
  variant?: RevealVariant;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const hidden =
    variant === "wipe"
      ? { clipPath: "inset(100% 0 0 0)" }
      : { opacity: 0, transform: "translateY(2.5rem)" };

  const shown =
    variant === "wipe"
      ? { clipPath: "inset(0% 0 0 0)" }
      : { opacity: 1, transform: "translateY(0)" };

  return (
    <div
      ref={ref}
      data-revealed={visible ? "true" : "false"}
      style={{
        ...(visible ? shown : hidden),
        transitionProperty: "opacity, transform, clip-path",
        transitionDuration: variant === "wipe" ? "1200ms" : "900ms",
        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
        transitionDelay: `${delay}ms`,
      }}
      className={className}
    >
      {children}
    </div>
  );
}
