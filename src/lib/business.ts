import siteConfig from "@config";
import { env } from "@/lib/env";

/**
 * Email de la profesional: recibe el aviso de cada reserva y es la dirección de
 * respuesta de los correos que se le envían a la clienta.
 *
 * Se puede cambiar con la variable de entorno OWNER_EMAIL sin tocar el código,
 * que es lo cómodo al desplegar y, sobre todo, al revender la web a otra
 * profesional: la misma copia sirve cambiando solo el entorno.
 */
export function ownerEmail(): string {
  return env("OWNER_EMAIL") || siteConfig.business.ownerEmail;
}

/**
 * Cómo puede contactar la clienta, según los canales que estén configurados.
 * Sin teléfono ni WhatsApp, se le remite al email, que siempre existe porque es
 * por donde recibe la confirmación.
 */
export function contactSentence(): string {
  const { phone, whatsapp } = siteConfig.business;
  if (phone && whatsapp) return `escríbeme por WhatsApp al ${phone}`;
  if (phone) return `llámame al ${phone}`;
  return "responde a este email y lo vemos";
}
