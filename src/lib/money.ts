import siteConfig from "@config";

const { locale, currency } = siteConfig.business;

const whole = new Intl.NumberFormat(locale, {
  style: "currency",
  currency,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const withCents = new Intl.NumberFormat(locale, {
  style: "currency",
  currency,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * 2700 -> "27 €" ; 2090 -> "20,90 €"
 *
 * Los importes redondos se muestran sin decimales, que es como se escriben los
 * precios de una carta. En cuanto hay céntimos se muestran los dos, porque
 * "20,9 €" no es como se escribe el dinero.
 */
export function formatCents(cents: number): string {
  return cents % 100 === 0 ? whole.format(cents / 100) : withCents.format(cents / 100);
}

/** Con prefijo "desde" cuando el precio puede subir según el diseño. */
export function formatPrice(cents: number, isFrom = false): string {
  return isFrom ? `desde ${formatCents(cents)}` : formatCents(cents);
}
