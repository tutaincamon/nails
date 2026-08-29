import type { BookingRow } from "@/lib/db";

/*
 * Lo que de verdad costó una cita, frente a lo que costaba al reservarla.
 *
 * `price_cents` es el precio de la reserva: lo que la clienta vio y aceptó. No
 * se toca nunca. Es la cifra que salió en su email de confirmación y sobre la
 * que aceptó la política de cancelación, así que reescribirla dejaría sin
 * respaldo un cobro por plantón.
 *
 * `final_price_cents` es lo que acabó costando, que solo se sabe al terminar:
 * dos uñas con gemas, una reparación, un diseño que llevó el doble. Vale 0
 * mientras nadie lo ajuste, y entonces manda el precio de la reserva.
 *
 * Tenerlos por separado en lugar de pisar uno con otro es justo lo que permite
 * mirar atrás y ver "presupuesté 35, cobré 45" en vez de solo el 45.
 */

/** Tope de cordura: por encima de esto es una errata, no un precio. */
export const MAX_PRECIO_CENTS = 100_000;

/** Lo que se cobró: el precio final si se ajustó, y si no el de la reserva. */
export function cobradoCents(booking: BookingRow): number {
  return booking.final_price_cents > 0 ? booking.final_price_cents : booking.price_cents;
}

/** true si lo cobrado no coincide con lo presupuestado. */
export function precioAjustado(booking: BookingRow): boolean {
  return booking.final_price_cents > 0 && booking.final_price_cents !== booking.price_cents;
}

/**
 * Cita cuyo importe sigue siendo una estimación: el servicio era "desde" y
 * nadie ha confirmado en cuánto quedó.
 *
 * Confirmar el mismo precio que ya tenía SÍ cuenta como confirmar: por eso
 * mira si se ha ajustado, no si el número ha cambiado.
 */
export function precioSinConfirmar(booking: BookingRow): boolean {
  return booking.price_from === 1 && booking.final_price_cents === 0;
}
