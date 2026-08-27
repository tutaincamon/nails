import siteConfig from "@config";
import type { BookingRow } from "@/lib/db";

/*
 * Lo que cuesta no venir, en un solo sitio.
 *
 * Este número aparece en la web al cancelar, en el email de cancelación y en el
 * panel al cobrar. Calcularlo por separado en cada uno es la forma segura de
 * que un día digan cosas distintas, y aquí eso significa decirle a una clienta
 * que se le cobran 27 € y cobrarle otra cosa.
 */

/** Importe que se le cobraría por no acudir o cancelar tarde, en céntimos. */
export function noShowCents(booking: BookingRow): number {
  if (!siteConfig.noShow.enabled) return 0;
  const porcentaje = Math.min(100, Math.max(0, siteConfig.noShow.chargePercent));
  // Lo ya cobrado como señal se descuenta: no se cobra dos veces lo mismo.
  return Math.max(0, Math.round((booking.price_cents * porcentaje) / 100) - booking.deposit_cents);
}

/** true si esa cancelación entra dentro del plazo que se cobra. */
export function esCancelacionTardia(horasQueFaltan: number): boolean {
  return siteConfig.noShow.enabled && horasQueFaltan < siteConfig.booking.cancellationHours;
}
