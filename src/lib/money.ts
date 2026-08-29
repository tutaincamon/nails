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

/**
 * Lee un importe escrito a mano y lo pasa a céntimos.
 *
 *   "42"  "42,5"  "42.50"  "42,50 €"  ->  4250
 *   ""  "hola"  "-5"  "42,555"        ->  null
 *
 * Acepta coma y punto porque el teclado de un móvil da una cosa o la otra
 * según el idioma, y quien escribe el precio no tiene por qué acordarse de
 * cuál le toca. Lo que no reconoce lo rechaza en vez de adivinar: un importe
 * mal interpretado se convierte en un número de la contabilidad que nadie
 * vuelve a mirar.
 */
export function parseEuros(text: string): number | null {
  const limpio = text.trim().replace(/[^\d,.-]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null;
  return Math.round(Number(limpio) * 100);
}
