"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import siteConfig from "@config";
import type { DiasSueltos, WeeklyHours } from "@/lib/db";
import { addDays, formatDateLong, weekdayOf } from "@/lib/time";

/*
 * Planificar las próximas semanas día a día.
 *
 * El horario semanal sirve para la rutina, pero una semana no se parece a la
 * otra: hay semanas con un festivo, otras en las que se trabaja el sábado. Aquí
 * se ve el calendario con la fecha real de cada día —"lunes 23 de
 * septiembre"— y se puede cambiar cualquiera.
 *
 * Solo se guardan los días que ella toca. Lo demás sigue su horario de siempre,
 * así que no tiene que rellenar un mes entero para cambiar un martes.
 */

const SEMANAS = 5;

type Tramo = { start: string; end: string };

export function PlanificarMes({
  desde,
  semanal,
  dias,
}: {
  /** Primer día que se muestra, normalmente hoy. */
  desde: string;
  semanal: WeeklyHours;
  dias: DiasSueltos;
}) {
  const router = useRouter();
  const [borrador, setBorrador] = useState<DiasSueltos>(dias);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<string | null>(null);

  /* Se empieza el lunes de la semana en curso, para que el calendario cuadre. */
  const inicio = addDays(desde, -((weekdayOf(desde) + 6) % 7));
  const fechas = Array.from({ length: SEMANAS * 7 }, (_, i) => addDays(inicio, i));

  /** Lo que rige ese día: su plan propio si lo tiene, o el horario semanal. */
  function tramosDe(fecha: string): { tramos: Tramo[]; propio: boolean } {
    const propio = borrador[fecha];
    if (propio) return { tramos: propio, propio: true };
    return { tramos: semanal[weekdayOf(fecha)] ?? [], propio: false };
  }

  function cambiar(fecha: string, tramos: Tramo[]) {
    setBorrador({ ...borrador, [fecha]: tramos });
    setGuardado(null);
  }

  async function guardar(fecha: string, tramos: Tramo[] | "seguir") {
    setGuardando(fecha);
    setError(null);
    const cuerpo =
      tramos === "seguir" ? { date: fecha, seguir: true } : { date: fecha, ranges: tramos };

    const r = await fetch("/api/admin/dias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    const d = (await r.json()) as { ok: boolean; error?: string };
    setGuardando(null);

    if (!d.ok) {
      setError(d.error ?? "No se pudo guardar ese día.");
      return;
    }

    if (tramos === "seguir") {
      const copia = { ...borrador };
      delete copia[fecha];
      setBorrador(copia);
    }
    setGuardado(fecha);
    router.refresh();
  }

  const hoy = desde;

  return (
    <div className="card p-5">
      <h2 className="text-[19px]">Planificar las próximas semanas</h2>
      <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-muted">
        Aquí cambias días sueltos sin tocar tu horario de siempre. Los días en gris siguen tu
        horario semanal; en cuanto tocas uno, ese día pasa a tener el suyo propio y se marca.
      </p>

      {error && <p className="mt-4 text-[13.5px] text-red-700">{error}</p>}

      <div className="mt-5 space-y-6">
        {Array.from({ length: SEMANAS }, (_, s) => {
          const semana = fechas.slice(s * 7, s * 7 + 7);
          return (
            <div key={s}>
              <p className="eyebrow">
                Semana del {formatDateLong(semana[0]).replace(/^\w+, /, "")}
              </p>
              <div className="mt-3 divide-y divide-line border-y border-line">
                {semana.map((fecha) => (
                  <Dia
                    key={fecha}
                    fecha={fecha}
                    pasado={fecha < hoy}
                    {...tramosDe(fecha)}
                    guardando={guardando === fecha}
                    guardado={guardado === fecha}
                    onCambiar={(t) => cambiar(fecha, t)}
                    onGuardar={(t) => guardar(fecha, t)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Dia({
  fecha,
  tramos,
  propio,
  pasado,
  guardando,
  guardado,
  onCambiar,
  onGuardar,
}: {
  fecha: string;
  tramos: Tramo[];
  propio: boolean;
  pasado: boolean;
  guardando: boolean;
  guardado: boolean;
  onCambiar: (t: Tramo[]) => void;
  onGuardar: (t: Tramo[] | "seguir") => void;
}) {
  /* "lunes 23 de septiembre", que es como ella piensa en sus días. */
  const etiqueta = formatDateLong(fecha);

  if (pasado) {
    return (
      <div className="py-2.5 text-[13px] text-muted/50">
        {etiqueta} · pasado
      </div>
    );
  }

  return (
    <div className="grid gap-2 py-3 sm:grid-cols-[190px_1fr]">
      <div>
        <p className={`text-[14px] ${propio ? "font-semibold text-ink" : "text-muted"}`}>
          {etiqueta}
        </p>
        <p className="text-[12px] text-muted/80">
          {propio ? "planificado" : "tu horario de siempre"}
          {tramos.length === 0 && " · cerrado"}
        </p>
      </div>

      <div className="space-y-2">
        {tramos.map((t, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <input
              type="time"
              className="field w-[108px] py-1"
              value={t.start}
              onChange={(e) =>
                onCambiar(tramos.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))
              }
            />
            <span className="text-muted">–</span>
            <input
              type="time"
              className="field w-[108px] py-1"
              value={t.end}
              onChange={(e) =>
                onCambiar(tramos.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))
              }
            />
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => onCambiar(tramos.filter((_, j) => j !== i))}
            >
              Quitar
            </button>
          </div>
        ))}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() =>
              onCambiar([
                ...tramos,
                tramos.length === 0 ? { start: "10:00", end: "14:00" } : { start: "16:00", end: "20:00" },
              ])
            }
          >
            {tramos.length === 0 ? "Abrir este día" : "Añadir franja"}
          </button>

          {tramos.length > 0 && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => onCambiar([])}>
              Cerrar el día
            </button>
          )}

          <button
            type="button"
            className="btn-sm border border-primary text-primary disabled:opacity-40"
            disabled={guardando}
            onClick={() => onGuardar(tramos)}
          >
            {guardando ? "Guardando…" : guardado ? "Guardado" : "Guardar este día"}
          </button>

          {propio && (
            <button
              type="button"
              className="btn-ghost btn-sm"
              disabled={guardando}
              onClick={() => onGuardar("seguir")}
            >
              Volver a mi horario
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
