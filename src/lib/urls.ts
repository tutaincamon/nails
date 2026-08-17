/** URL base pública del sitio, para los enlaces que van dentro de los emails. */
export function baseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

/** Enlace para que la clienta vea o cancele su cita. */
export function manageUrl(code: string, token: string): string {
  return `${baseUrl()}/reserva/${code}?t=${token}`;
}

/** Enlace a la pasarela de pago de la señal. */
export function payUrl(code: string, token: string): string {
  return `${baseUrl()}/pago/${code}?t=${token}`;
}

export function adminUrl(): string {
  return `${baseUrl()}/admin`;
}
