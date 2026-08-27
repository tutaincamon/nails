import { env } from "@/lib/env";
/** URL base pública del sitio, para los enlaces que van dentro de los emails. */
export function baseUrl(): string {
  const explicit = env("NEXT_PUBLIC_SITE_URL");
  if (explicit) return explicit.replace(/\/$/, "");
  if (env("VERCEL_PROJECT_PRODUCTION_URL")) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  const vercelUrl = env("VERCEL_URL");
  if (vercelUrl) return `https://${vercelUrl}`;
  return `http://localhost:${env("PORT") ?? 3000}`;
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

/** Enlace al listado de citas de una clienta. */
export function portalUrl(testigo: string): string {
  return `${baseUrl()}/mis-citas/${testigo}`;
}
