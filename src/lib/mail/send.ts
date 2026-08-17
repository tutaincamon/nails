import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import siteConfig from "@config";
import { logEmail } from "@/lib/db";
import { ownerEmail } from "@/lib/business";

/*
 * Envío de emails con tres modos, elegidos automáticamente según las variables
 * de entorno (se comprueban en este orden):
 *
 *   SMTP       Si hay SMTP_HOST y SMTP_USER. Sirve cualquier proveedor: Gmail
 *              con contraseña de aplicación, el correo del hosting, Zoho, etc.
 *              Es la vía más rápida para que los correos lleguen de verdad sin
 *              tener que comprar un dominio.
 *
 *   RESEND     Si hay RESEND_API_KEY y MAIL_FROM. Mejor entregabilidad a largo
 *              plazo, pero exige un dominio propio verificado.
 *
 *   SIMULADO   Si no hay nada configurado. El email NO sale a internet: se
 *              guarda en la base de datos y como archivo en data/outbox/, y se
 *              lee entero desde /admin → pestaña Emails.
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

export type Transport = "smtp" | "resend" | "simulado";
export type SendResult = { ok: boolean; transport: Transport; error?: string };

const OUTBOX_DIR = path.join(process.env.DATA_DIR ?? path.join(process.cwd(), "data"), "outbox");

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
}

function resendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

/** Modo activo, para poder avisarlo en el panel. */
export function mailTransport(): Transport {
  if (smtpConfigured()) return "smtp";
  if (resendConfigured()) return "resend";
  return "simulado";
}

export function isRealMailConfigured(): boolean {
  return mailTransport() !== "simulado";
}

/**
 * Remitente. Tiene que corresponder con la cuenta que envía o el proveedor lo
 * rechaza: Gmail, por ejemplo, reescribe cualquier otro remitente.
 */
function fromAddress(): string {
  if (process.env.MAIL_FROM) return process.env.MAIL_FROM;
  const user = process.env.SMTP_USER;
  if (user) return `${siteConfig.business.name} <${user}>`;
  return ownerEmail();
}

export async function sendMail(mail: Mail): Promise<SendResult> {
  const transport = mailTransport();
  if (transport === "smtp") return sendWithSmtp(mail);
  if (transport === "resend") return sendWithResend(mail);
  return simulate(mail);
}

/* -------------------------------------------------------------------------- */
/*  SMTP (Gmail, correo del hosting, etc.)                                    */
/* -------------------------------------------------------------------------- */
async function sendWithSmtp(mail: Mail): Promise<SendResult> {
  try {
    const nodemailer = await import("nodemailer");
    const port = Number(process.env.SMTP_PORT ?? 465);

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      // 465 va cifrado desde el principio; 587 empieza en claro y sube a TLS.
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: fromAddress(),
      to: mail.to,
      replyTo: ownerEmail(),
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });

    await record(mail, "smtp", null);
    return { ok: true, transport: "smtp" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await record(mail, "smtp", message);
    console.error(`[mail] SMTP no pudo enviar a ${mail.to}: ${message}`);
    return { ok: false, transport: "smtp", error: message };
  }
}

/* -------------------------------------------------------------------------- */
/*  Resend                                                                    */
/* -------------------------------------------------------------------------- */
async function sendWithResend(mail: Mail): Promise<SendResult> {
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: process.env.MAIL_FROM!,
      to: mail.to,
      replyTo: ownerEmail(),
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });

    if (error) {
      await record(mail, "resend", error.message);
      console.error(`[mail] Resend rechazó el envío a ${mail.to}: ${error.message}`);
      return { ok: false, transport: "resend", error: error.message };
    }

    await record(mail, "resend", null);
    return { ok: true, transport: "resend" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await record(mail, "resend", message);
    console.error(`[mail] Error enviando a ${mail.to}: ${message}`);
    return { ok: false, transport: "resend", error: message };
  }
}

/* -------------------------------------------------------------------------- */
/*  Modo simulado                                                             */
/* -------------------------------------------------------------------------- */
async function simulate(mail: Mail): Promise<SendResult> {
  await record(mail, "simulado", null);

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

/** Deja constancia del email para poder revisarlo después desde el panel. */
async function record(mail: Mail, transport: Transport, error: string | null) {
  try {
    await logEmail({
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
