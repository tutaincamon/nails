import siteConfig from "@config";
import type { BookingRow } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { formatDateLong, formatDuration } from "@/lib/time";
import { ownerEmail } from "@/lib/business";

/*
 * Plantillas de email en HTML con estilos en línea y tablas: es la única forma
 * de que se vean bien en Gmail, Outlook y clientes de móvil.
 */

const { business, theme, deposit } = siteConfig;

export type AddOnSnapshot = { name: string; price: number };

function addOnsOf(booking: BookingRow): AddOnSnapshot[] {
  try {
    return JSON.parse(booking.addons_json) as AddOnSnapshot[];
  } catch {
    return [];
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shell(opts: {
  preheader: string;
  heading: string;
  intro: string;
  body: string;
  accentBar?: string;
}): string {
  const bar = opts.accentBar ?? theme.primary;
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(opts.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${theme.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${theme.ink};">
<div style="display:none;font-size:1px;color:${theme.bg};max-height:0;overflow:hidden;">${escapeHtml(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${theme.bg};padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${theme.surface};border-radius:16px;overflow:hidden;border:1px solid ${theme.border};">
      <tr><td style="height:4px;background:${bar};"></td></tr>
      <tr><td style="padding:32px 32px 8px;">
        <p style="margin:0 0 4px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:${theme.muted};">${escapeHtml(business.name)}</p>
        <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;font-weight:600;color:${theme.ink};">${escapeHtml(opts.heading)}</h1>
        <p style="margin:0;font-size:15px;line-height:1.6;color:${theme.muted};">${opts.intro}</p>
      </td></tr>
      <tr><td style="padding:20px 32px 32px;">${opts.body}</td></tr>
      <tr><td style="padding:20px 32px;background:${theme.bg};border-top:1px solid ${theme.border};">
        <p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:${theme.muted};">
          ${escapeHtml(business.name)} · ${escapeHtml(business.address.area)}<br>
          ${escapeHtml(business.phone)} · <a href="mailto:${escapeHtml(ownerEmail())}" style="color:${theme.primary};text-decoration:none;">${escapeHtml(ownerEmail())}</a>
        </p>
        <p style="margin:0;font-size:12px;color:${theme.muted};">Instagram: @${escapeHtml(business.instagram)}</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function detailsTable(booking: BookingRow): string {
  const addOns = addOnsOf(booking);
  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:10px 0;font-size:14px;color:${theme.muted};width:38%;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:10px 0;font-size:14px;color:${theme.ink};font-weight:500;vertical-align:top;">${value}</td>
    </tr>`;

  const priceLabel = booking.price_from
    ? `${formatCents(booking.price_cents)} <span style="font-weight:400;color:${theme.muted};">(desde — se ajusta según el diseño)</span>`
    : formatCents(booking.price_cents);

  const extras =
    addOns.length > 0
      ? row("Extras", addOns.map((a) => `${escapeHtml(a.name)} (+${formatCents(Math.round(a.price * 100))})`).join("<br>"))
      : "";

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    ${row("Servicio", escapeHtml(booking.service_name))}
    ${extras}
    ${row("Día", `${escapeHtml(formatDateLong(booking.date))}`)}
    ${row("Hora", `${escapeHtml(booking.start_time)} – ${escapeHtml(booking.end_time)} <span style="font-weight:400;color:${theme.muted};">(${formatDuration(booking.duration_min)})</span>`)}
    ${row("Precio", priceLabel)}
    ${row("Código de reserva", `<code style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:${theme.bg};padding:2px 6px;border-radius:4px;">${escapeHtml(booking.code)}</code>`)}
  </table>`;
}

function button(href: string, label: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
    <tr><td style="border-radius:999px;background:${theme.primary};">
      <a href="${href}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#fff;text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
    </td></tr>
  </table>`;
}

function calloutBox(text: string): string {
  return `<div style="margin:20px 0 0;padding:14px 16px;background:${theme.bg};border-left:3px solid ${theme.accent};border-radius:6px;font-size:14px;line-height:1.6;color:${theme.ink};">${text}</div>`;
}

/* -------------------------------------------------------------------------- */
/*  1. Confirmación para la clienta                                           */
/* -------------------------------------------------------------------------- */
export function clientConfirmation(booking: BookingRow, manageUrl: string) {
  const depositLine =
    booking.deposit_status === "paid"
      ? `Señal de ${formatCents(booking.deposit_cents)} pagada. Se descuenta del precio final: en el estudio quedarían ${formatCents(Math.max(0, booking.price_cents - booking.deposit_cents))}${booking.price_from ? " o más, según el diseño" : ""}.`
      : booking.deposit_status === "on_site"
        ? "Pagarás el importe completo en el estudio (efectivo o Bizum)."
        : "";

  const body = `
    ${detailsTable(booking)}
    ${depositLine ? calloutBox(depositLine) : ""}
    ${calloutBox(`<strong>Dónde es:</strong> ${escapeHtml(business.address.area)}.<br>${escapeHtml(business.address.note)}`)}
    ${button(manageUrl, "Ver o cancelar mi cita")}
    <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:${theme.muted};">
      Puedes cancelar sin coste hasta ${siteConfig.booking.cancellationHours} h antes desde ese enlace.
      Si necesitas cambiar la hora o tienes dudas del diseño, escríbeme por WhatsApp al ${escapeHtml(business.phone)}.
    </p>
    <p style="margin:20px 0 0;font-size:14px;line-height:1.7;color:${theme.ink};">
      <strong>Antes de venir:</strong><br>
      ${siteConfig.content.policies.map((p) => `· ${escapeHtml(p)}`).join("<br>")}
    </p>`;

  return {
    subject: `Cita confirmada · ${formatDateLong(booking.date)} a las ${booking.start_time}`,
    html: shell({
      preheader: `Tu cita de ${booking.service_name} está confirmada.`,
      heading: `¡Tu cita está reservada, ${booking.client_name.split(" ")[0]}!`,
      intro: `Te espero el <strong style="color:${theme.ink};">${escapeHtml(formatDateLong(booking.date))} a las ${escapeHtml(booking.start_time)}</strong>. Aquí tienes todos los detalles.`,
      body,
    }),
    text: [
      `Cita confirmada en ${business.name}`,
      ``,
      `Servicio: ${booking.service_name}`,
      `Día: ${formatDateLong(booking.date)}`,
      `Hora: ${booking.start_time} - ${booking.end_time} (${formatDuration(booking.duration_min)})`,
      `Precio: ${formatCents(booking.price_cents)}${booking.price_from ? " (desde)" : ""}`,
      `Código: ${booking.code}`,
      ``,
      depositLine,
      ``,
      `Dónde: ${business.address.area}. ${business.address.note}`,
      ``,
      `Ver o cancelar tu cita: ${manageUrl}`,
    ].join("\n"),
  };
}

/* -------------------------------------------------------------------------- */
/*  2. Aviso para la profesional                                              */
/* -------------------------------------------------------------------------- */
export function ownerNotification(booking: BookingRow, adminUrl: string) {
  const addOns = addOnsOf(booking);
  const body = `
    ${detailsTable(booking)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;border-top:1px solid ${theme.border};">
      <tr><td style="padding:16px 0 0;">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${theme.muted};">Datos de la clienta</p>
        <p style="margin:0;font-size:15px;line-height:1.7;color:${theme.ink};">
          <strong>${escapeHtml(booking.client_name)}</strong><br>
          <a href="tel:${escapeHtml(booking.client_phone)}" style="color:${theme.primary};text-decoration:none;">${escapeHtml(booking.client_phone)}</a><br>
          <a href="mailto:${escapeHtml(booking.client_email)}" style="color:${theme.primary};text-decoration:none;">${escapeHtml(booking.client_email)}</a>
        </p>
      </td></tr>
    </table>
    ${booking.notes ? calloutBox(`<strong>Nota de la clienta:</strong><br>${escapeHtml(booking.notes)}`) : ""}
    ${
      booking.deposit_cents > 0
        ? calloutBox(
            booking.deposit_status === "paid"
              ? `Señal de <strong>${formatCents(booking.deposit_cents)}</strong> cobrada${booking.payment_ref ? ` (ref. ${escapeHtml(booking.payment_ref)})` : ""}.`
              : `Sin señal: paga el total en el estudio.`,
          )
        : ""
    }
    ${addOns.length ? "" : ""}
    ${button(adminUrl, "Abrir la agenda")}`;

  return {
    subject: `Nueva reserva · ${booking.client_name} · ${booking.date} ${booking.start_time}`,
    html: shell({
      preheader: `${booking.client_name} ha reservado ${booking.service_name}.`,
      heading: "Tienes una reserva nueva",
      intro: `<strong style="color:${theme.ink};">${escapeHtml(booking.client_name)}</strong> ha reservado ${escapeHtml(booking.service_name)}.`,
      body,
      accentBar: theme.accent,
    }),
    text: [
      `Nueva reserva en ${business.name}`,
      ``,
      `${booking.client_name} · ${booking.client_phone} · ${booking.client_email}`,
      `Servicio: ${booking.service_name}`,
      `Día: ${formatDateLong(booking.date)} ${booking.start_time}-${booking.end_time}`,
      `Duración: ${formatDuration(booking.duration_min)}`,
      `Precio: ${formatCents(booking.price_cents)}`,
      booking.notes ? `Nota: ${booking.notes}` : "",
      `Señal: ${booking.deposit_status === "paid" ? formatCents(booking.deposit_cents) + " cobrada" : "no"}`,
      `Código: ${booking.code}`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

/* -------------------------------------------------------------------------- */
/*  3. Recordatorio del día antes                                             */
/* -------------------------------------------------------------------------- */
export function clientReminder(booking: BookingRow, manageUrl: string) {
  const body = `
    ${detailsTable(booking)}
    ${calloutBox(`<strong>Dónde es:</strong> ${escapeHtml(business.address.area)}.<br>${escapeHtml(business.address.note)}`)}
    <p style="margin:20px 0 0;font-size:14px;line-height:1.7;color:${theme.ink};">
      <strong>Recuerda:</strong><br>
      ${siteConfig.content.policies.map((p) => `· ${escapeHtml(p)}`).join("<br>")}
    </p>
    ${button(manageUrl, "Ver mi cita")}
    <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:${theme.muted};">
      Si no puedes venir, avísame cuanto antes por WhatsApp (${escapeHtml(business.phone)}) para poder dar el hueco a otra persona.
    </p>`;

  return {
    subject: `Mañana tienes cita a las ${booking.start_time} · ${business.name}`,
    html: shell({
      preheader: `Recordatorio: mañana a las ${booking.start_time}.`,
      heading: "Nos vemos mañana",
      intro: `Un recordatorio rápido de tu cita de <strong style="color:${theme.ink};">${escapeHtml(booking.service_name)}</strong>, mañana a las ${escapeHtml(booking.start_time)}.`,
      body,
      accentBar: theme.accent,
    }),
    text: [
      `Recordatorio de cita en ${business.name}`,
      ``,
      `Mañana ${formatDateLong(booking.date)} a las ${booking.start_time}`,
      `Servicio: ${booking.service_name} (${formatDuration(booking.duration_min)})`,
      `Dónde: ${business.address.area}`,
      ``,
      `Ver tu cita: ${manageUrl}`,
    ].join("\n"),
  };
}

/* -------------------------------------------------------------------------- */
/*  4. Cancelación                                                            */
/* -------------------------------------------------------------------------- */
export function cancellationNotice(booking: BookingRow, forOwner: boolean) {
  const refundLine =
    booking.deposit_status === "paid"
      ? forOwner
        ? `Había una señal de ${formatCents(booking.deposit_cents)} pagada: revisa si toca devolverla.`
        : `${deposit.note}`
      : "";

  const body = `
    ${detailsTable(booking)}
    ${refundLine ? calloutBox(refundLine) : ""}
    ${
      forOwner
        ? `<p style="margin:20px 0 0;font-size:14px;line-height:1.7;color:${theme.ink};">El hueco vuelve a estar libre en la agenda automáticamente.</p>`
        : `<p style="margin:20px 0 0;font-size:14px;line-height:1.7;color:${theme.ink};">Cuando quieras volver, puedes reservar de nuevo cuando te venga bien. ¡Nos vemos pronto!</p>`
    }`;

  return {
    subject: forOwner
      ? `Cita cancelada · ${booking.client_name} · ${booking.date} ${booking.start_time}`
      : `Tu cita del ${formatDateLong(booking.date)} ha sido cancelada`,
    html: shell({
      preheader: "Cita cancelada.",
      heading: forOwner ? "Se ha cancelado una cita" : "Cita cancelada",
      intro: forOwner
        ? `<strong style="color:${theme.ink};">${escapeHtml(booking.client_name)}</strong> ha cancelado su cita.`
        : "Hemos cancelado tu cita como pediste. Aquí queda el detalle por si lo necesitas.",
      body,
      accentBar: theme.muted,
    }),
    text: [
      forOwner ? `Cita cancelada por ${booking.client_name}` : `Tu cita ha sido cancelada`,
      ``,
      `Servicio: ${booking.service_name}`,
      `Día: ${formatDateLong(booking.date)} ${booking.start_time}`,
      `Código: ${booking.code}`,
      refundLine,
    ].join("\n"),
  };
}

/* -------------------------------------------------------------------------- */
/*  5. Pendiente de pago (si abandona el checkout)                            */
/* -------------------------------------------------------------------------- */
export function pendingPaymentNotice(booking: BookingRow, payUrl: string) {
  const body = `
    ${detailsTable(booking)}
    ${calloutBox(`Tu hueco está guardado pero <strong>la cita no queda confirmada</strong> hasta que se abone la señal de ${formatCents(booking.deposit_cents)}.`)}
    ${button(payUrl, `Pagar la señal (${formatCents(booking.deposit_cents)})`)}`;

  return {
    subject: `Termina tu reserva · ${formatDateLong(booking.date)} a las ${booking.start_time}`,
    html: shell({
      preheader: "Falta la señal para confirmar tu cita.",
      heading: "Falta un paso",
      intro: "Te he guardado el hueco, pero queda pendiente la señal para confirmarlo.",
      body,
      accentBar: theme.accent,
    }),
    text: [
      `Reserva pendiente en ${business.name}`,
      `Día: ${formatDateLong(booking.date)} ${booking.start_time}`,
      `Falta pagar la señal de ${formatCents(booking.deposit_cents)}: ${payUrl}`,
    ].join("\n"),
  };
}
