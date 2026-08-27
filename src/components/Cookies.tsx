"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";

/*
 * Aviso de cookies con dos botones y sin trampa.
 *
 * Lo importante: rechazar RECHAZA de verdad. La analítica solo se carga si se
 * acepta, así que el banner no es un adorno para aparentar que se cumple. Por
 * eso vive aquí y no en el layout: es este componente el que decide.
 *
 * Mientras no se ha elegido nada, tampoco se carga: quien no responde no ha
 * consentido.
 */

const CLAVE = "studio:cookies";
type Eleccion = "aceptadas" | "rechazadas" | null;

function leer(): Eleccion {
  try {
    const v = window.localStorage.getItem(CLAVE);
    return v === "aceptadas" || v === "rechazadas" ? v : null;
  } catch {
    return null;
  }
}

export function Cookies() {
  const [eleccion, setEleccion] = useState<Eleccion>(null);
  /* Hasta leer el navegador no se pinta nada, para no enseñar el aviso a quien ya respondió. */
  const [listo, setListo] = useState(false);

  useEffect(() => {
    setEleccion(leer());
    setListo(true);
  }, []);

  function elegir(valor: Exclude<Eleccion, null>) {
    try {
      window.localStorage.setItem(CLAVE, valor);
    } catch {
      /* Si no se puede guardar, se preguntará otra vez. Mejor eso que asumir un sí. */
    }
    setEleccion(valor);
  }

  if (!listo) return null;

  return (
    <>
      {eleccion === "aceptadas" && <Analytics />}

      {eleccion === null && (
        <div
          role="dialog"
          aria-label="Aviso de cookies"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
        >
          <div className="section flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13.5px] leading-relaxed text-muted">
              Uso medición anónima de visitas para saber si la web funciona bien. Puedes rechazarla
              y todo lo demás seguirá igual.{" "}
              <Link href="/cookies" className="font-semibold text-primary hover:underline">
                Más información
              </Link>
              .
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => elegir("rechazadas")}
              >
                Rechazar
              </button>
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={() => elegir("aceptadas")}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
