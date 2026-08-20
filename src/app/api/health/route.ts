import { NextResponse } from "next/server";
import { bookingsOn, isRemoteDatabase, recentEmails } from "@/lib/db";
import { env } from "@/lib/env";
import { mailTransport } from "@/lib/mail/send";
import { isStripeConfigured } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * GET /api/health — comprobación de estado.
 *
 * Dice si la base de datos responde y qué modo tiene activo cada pieza, para
 * poder diagnosticar un despliegue sin entrar a mirar los registros.
 *
 * No devuelve ningún secreto: solo si cada variable está puesta o no, nunca su
 * valor. Los mensajes de error se limpian de posibles credenciales antes de
 * salir, por si el cliente de la base de datos las incluyera.
 */

/** Oculta cadenas largas que puedan ser credenciales dentro de un error. */
function redact(text: string): string {
  return text
    .replace(/eyJ[A-Za-z0-9_\-.]{20,}/g, "[token oculto]")
    .replace(/[A-Za-z0-9_\-]{40,}/g, "[oculto]")
    // Los errores de SMTP suelen citar la cuenta que intentó enviar.
    .replace(/[^\s<>"]+@[^\s<>"]+/g, "[correo oculto]");
}

export async function GET() {
  const url = process.env.TURSO_DATABASE_URL;

  const config = {
    baseDeDatos: isRemoteDatabase() ? "turso" : "archivo local",
    tursoUrlPuesta: Boolean(url),
    tursoUrlProtocolo: url ? `${url.split("://")[0]}://` : null,
    tursoTokenPuesto: Boolean(process.env.TURSO_AUTH_TOKEN),
    emails: mailTransport(),
    // Qué piezas del correo están puestas. Nunca su valor, solo si existen:
    // un envío puede quedarse a medias por faltar solo la contraseña.
    smtpUsuarioPuesto: Boolean(env("SMTP_USER")),
    smtpContrasenaPuesta: Boolean(env("SMTP_PASSWORD")),
    remitentePuesto: Boolean(env("MAIL_FROM")),
    ownerEmailPuesto: Boolean(process.env.OWNER_EMAIL),
    adminPasswordPuesta: Boolean(process.env.ADMIN_PASSWORD),
    cronSecretPuesto: Boolean(process.env.CRON_SECRET),
    pagos: isStripeConfigured() ? "stripe" : "demo",
  };

  try {
    // Consulta trivial: si esto responde, la conexión y las tablas están bien.
    await bookingsOn("1970-01-01");

    /*
     * Último fallo de envío, si lo hay. Es lo que convierte "no me llega el
     * correo" en un motivo concreto, sin tener que entrar al panel. Va limpio
     * de credenciales y de direcciones antes de salir.
     */
    const fallido = (await recentEmails(15)).find((e) => e.error);
    const ultimoErrorDeCorreo = fallido
      ? { cuando: fallido.created_at, motivo: redact(fallido.error!).slice(0, 300) }
      : null;

    return NextResponse.json({ ok: true, consulta: "correcta", ultimoErrorDeCorreo, ...config });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, consulta: "falla", error: redact(message).slice(0, 400), ...config },
      { status: 503 },
    );
  }
}
