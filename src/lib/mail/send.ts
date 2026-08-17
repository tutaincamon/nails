import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import siteConfig from "@config";
import { logEmail } from "@/lib/db";

/*
 * Envío de emails con dos modos:
 *
 *   REAL      Si existe RESEND_API_KEY, se envía de verdad con Resend.
 *   SIMULADO  Si no hay clave, el email NO sale a internet: se guarda en la
 *             base de datos y como archivo .html en data/outbox/, y se puede
 *             leer entero desde /admin → pestaña Emails.
 *
 * Así el prototipo se puede enseñar y probar el flujo completo sin dar de alta
 * ningún servicio ni dominio, y pasar a envío real es solo poner la clave.
 */

export type MailKind =
  | "client_confirmation"
  | "owner_notification"
  | "client_reminder"
  | "cancellation_client"
  | "cancellation_owner"
  | "pending_payment";

export type Mail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  kind: MailKind;
  bookingCode?: string | null;
};

export type SendResult = { ok: boolean; transport: "resend" | "simulado"; error?: string };

const OUTBOX_DIR = path.join(process.env.DATA_DIR ?? path.join(process.cwd(), "data"), "outbox");

export function isRealMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

export async function sendMail(mail: Mail): Promise<SendResult> {
  if (!isRealMailConfigured()) return simulate(mail);

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: process.env.MAIL_FROM!,
      to: mail.to,
      replyTo: siteConfig.business.ownerEmail,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });

    if (error) {
      record(mail, "resend", error.message);
      console.error(`[mail] Resend rechazó el envío a ${mail.to}: ${error.message}`);
      return { ok: false, transport: "resend", error: error.message };
    }

    record(mail, "resend", null);
    return { ok: true, transport: "resend" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    record(mail, "resend", message);
    console.error(`[mail] Error enviando a ${mail.to}: ${message}`);
    return { ok: false, transport: "resend", error: message };
  }
}

function simulate(mail: Mail): SendResult {
  record(mail, "simulado", null);

  try {
    mkdirSync(OUTBOX_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safeKind = mail.kind.replace(/[^a-z_]/g, "");
    writeFileSync(path.join(OUTBOX_DIR, `${stamp}-${safeKind}.html`), mail.html, "utf8");
  } catch (err) {
    // Si el disco es de solo lectura no pasa nada: el email ya está en la BBDD.
    console.warn(`[mail] No se pudo escribir en data/outbox: ${String(err)}`);
  }

  console.info(
    `[mail:SIMULADO] Para: ${mail.to} · Asunto: "${mail.subject}" · visible en /admin (pestaña Emails)`,
  );
  return { ok: true, transport: "simulado" };
}

function record(mail: Mail, transport: "resend" | "simulado", error: string | null) {
  try {
    logEmail({
      to_addr: mail.to,
      subject: mail.subject,
      kind: mail.kind,
      html: mail.html,
      text: mail.text,
      transport,
      booking_code: mail.bookingCode ?? null,
      error,
    });
  } catch (err) {
    console.error(`[mail] No se pudo registrar el email: ${String(err)}`);
  }
}

/** Envía varios emails sin que el fallo de uno impida el resto. */
export async function sendAll(mails: Mail[]): Promise<SendResult[]> {
  return Promise.all(mails.map((m) => sendMail(m)));
}
