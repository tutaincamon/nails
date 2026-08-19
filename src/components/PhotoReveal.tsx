"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

/*
 * Foto que se descubre al entrar en pantalla.
 *
 * El marco se abre de abajo arriba con clip-path mientras la imagen de dentro
 * pasa de un ligero acercamiento a su tamaño real. Los dos movimientos a la vez
 * dan la sensación de que la foto "aterriza" en su sitio, que es bastante más
 * vistoso que un simple desvanecido, y sigue siendo solo transform y clip-path.
 */
export function PhotoReveal({
  src,
  alt,
  delay = 0,
  sizes = "(max-width: 640px) 100vw, 45vw",
}: {
  src: string;
  alt: string;
  delay?: number;
  sizes?: string;
}) {
  const ref = useRef<HTMLElement>(null);
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

  return (
    <figure
      ref={ref}
      className="group relative aspect-[3/4] overflow-hidden bg-line/40"
      style={{
        clipPath: visible ? "inset(0% 0 0 0)" : "inset(100% 0 0 0)",
        transition: `clip-path 1200ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
      }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className="object-cover transition-transform duration-[1600ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.05]"
        style={{
          transform: visible ? "scale(1)" : "scale(1.18)",
          transitionDelay: `${delay}ms`,
        }}
      />
    </figure>
  );
}
