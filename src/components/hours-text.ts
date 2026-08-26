import type { WeeklyHours } from "@/lib/db";

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export type HoursRow = { label: string; hours: string; closed: boolean };

/**
 * Convierte un horario semanal en filas legibles, agrupando los días seguidos
 * que tienen el mismo horario ("Lunes – Jueves  10:00–14:00…").
 *
 * Recibe el horario en vez de leerlo de la configuración porque desde que se
 * puede editar en el panel, el de la configuración es solo el valor inicial.
 */
export function formatDayHours(hours: WeeklyHours): HoursRow[] {
  const describe = (day: number) => {
    const ranges = hours[day] ?? [];
    if (ranges.length === 0) return "Cerrado";
    return ranges.map((r) => `${r.start}–${r.end}`).join(" · ");
  };

  const rows: HoursRow[] = [];
  let groupStart = 0;

  for (let i = 0; i < ORDER.length; i++) {
    const current = describe(ORDER[i]);
    const next = i + 1 < ORDER.length ? describe(ORDER[i + 1]) : null;

    if (current !== next) {
      const from = DAY_NAMES[ORDER[groupStart]];
      const to = DAY_NAMES[ORDER[i]];
      rows.push({
        label: groupStart === i ? from : `${from} – ${to}`,
        hours: current,
        closed: current === "Cerrado",
      });
      groupStart = i + 1;
    }
  }

  return rows;
}
