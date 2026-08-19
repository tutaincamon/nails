"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

/*
 * Foto de portada con dos movimientos que se suman:
 *
 *   Zoom lento    Un acercamiento continuo de 20 segundos. Es tan lento que no
 *                 se percibe como animación, solo hace que la imagen "respire"
 *                 en vez de parecer un cartel pegado.
 *
 *   Paralaje      Al bajar, la foto se desplaza a menos velocidad que el texto,
 *                 así que parece estar por detrás y no pegada al titular.
 *
 * El desplazamiento se calcula dentro de requestAnimationFrame: el evento de
 * scroll se dispara decenas de veces por segundo y tocar el estilo en cada uno
 * daría tirones en el móvil.
 */
export function HeroImage({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    if (query.matches) return;

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const element = ref.current;
        if (!element) return;
        // Se detiene al salir de pantalla: seguir calculando no aporta nada.
        const offset = Math.min(window.scrollY, window.innerHeight);
        element.style.transform = `translate3d(0, ${offset * 0.28}px, 0)`;
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={ref} className="absolute inset-0 will-change-transform">
      {/* Un poco más alto que la pantalla para que el paralaje no descubra el fondo. */}
      <div className="relative h-[125%] w-full overflow-hidden">
        <Image
          src={src}
          alt={alt}
          fill
          priority
          sizes="100vw"
          className={`object-cover ${reduced ? "" : "animate-kenburns"}`}
        />
      </div>
    </div>
  );
}
