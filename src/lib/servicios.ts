import type { BookingRow } from "@/lib/db";
import { formatCents } from "@/lib/money";

/*
 * Cómo leer los servicios y los extras de una cita ya guardada.
 *
 * Vive aparte porque lo usan sitios muy distintos —la ficha de la clienta, el
 * panel, los emails y las estadísticas— y todos tienen que contar lo mismo. La
 * primera versión guardaba un solo servicio por cita, así que aquí está también
 * la traducción de aquellas reservas: sin ella, todo lo reservado antes de
 * poder pedir manos y pies juntos aparecería vacío.
 */

export type ServicioGuardado = {
  id: string;
  name: string;
  /** Precio en euros el día en que se reservó. */
  price: number;
  durationMin: number;
  categoryName: string;
};

/** Los servicios de una cita. Nunca devuelve una lista vacía. */
export function serviciosDe(booking: BookingRow): ServicioGuardado[] {
  try {
    const parsed = JSON.parse(booking.services_json || "[]");
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as ServicioGuardado[];
  } catch {
    /* Una fila ilegible cae al plan B en lugar de romper la página. */
  }

  /*
   * Reserva anterior a que una cita pudiera tener varios servicios: lo que hay
   * es un único nombre, y su precio es el de la cita menos los extras.
   */
  const extras = extrasDe(booking).reduce((suma, e) => suma + e.lineCents, 0);
  return [
    {
      id: booking.service_id,
      name: booking.service_name,
      price: Math.max(0, booking.price_cents - extras) / 100,
      durationMin: booking.duration_min,
      categoryName: booking.category_name,
    },
  ];
}

export type ExtraGuardado = {
  name: string;
  /** Precio en euros de UNA unidad. */
  price: number;
  /** Cuántas. 1 en los extras que no se cobran por pieza. */
  units: number;
  /** Lo que suma en total: precio por unidad × unidades. */
  lineCents: number;
};

/** Los extras de una cita, con su cantidad ya resuelta. */
export function extrasDe(booking: BookingRow): ExtraGuardado[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(booking.addons_json || "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed.map((crudo) => {
    const extra = crudo as { name?: string; price?: number; units?: number };
    const price = Number(extra.price) || 0;
    // Sin `units` es un extra guardado antes de que existieran las cantidades.
    const units = Math.max(1, Math.round(Number(extra.units) || 1));
    return {
      name: String(extra.name ?? ""),
      price,
      units,
      lineCents: Math.round(price * 100) * units,
    };
  });
}

/** "Piedras o cristales ×10 (+10 €)" — o sin el ×N cuando solo hay una. */
export function textoExtra(extra: ExtraGuardado): string {
  const cantidad = extra.units > 1 ? ` ×${extra.units}` : "";
  return `${extra.name}${cantidad} (+${formatCents(extra.lineCents)})`;
}
