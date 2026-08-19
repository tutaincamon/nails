"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/*
 * Aparición al entrar en pantalla.
 *
 * Usa IntersectionObserver y no las animaciones CSS ligadas al scroll, que son
 * más elegantes pero todavía no funcionan en todos los navegadores. Se dispara
 * una sola vez: que un elemento vuelva a desvanecerse al subir marea.
 *
 * Si el sistema pide menos movimiento, el contenido aparece sin animación.
 */
export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  /** Milisegundos de retardo, para escalonar varios elementos seguidos. */
  delay?: number;
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
      // Se activa un poco antes de llegar al borde inferior.
      { rootMargin: "0px 0px -10% 0px", threshold: 0.15 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-[opacity,transform] duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
        visible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}
