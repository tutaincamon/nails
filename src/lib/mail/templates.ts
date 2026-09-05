import siteConfig from "@config";
import type { BookingRow } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { formatDateLong, formatDuration } from "@/lib/time";
import { ownerEmail } from "@/lib/business";
import { noShowCents } from "@/lib/policy";
import { contactSentence } from "@/lib/business";
import { extrasDe, textoExtra } from "@/lib/servicios";

/*
 * Plantillas de email en HTML con estilos en línea y tablas: es la única forma
 * de que se vean bien en Gmail, Outlook y clientes de móvil.
 */

const { business, theme, deposit } = siteConfig;

/* Los extras de la cita, con su cantidad. Ver src/lib/servicios.ts. */
const addOnsOf = extrasDe;

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
          ${business.phone ? escapeHtml(business.phone) + " · " : ""}<a href="mailto:${escapeHtml(ownerEmail())}" style="color:${theme.primary};text-decoration:none;">${escapeHtml(ownerEmail())}</a>
        </p>
        ${business.instagram ? `<p style="margin:0;font-size:12px;color:${theme.muted};">Instagram: @${escapeHtml(business.instagram)}</p>` : ""}
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
      ? row("Extras", addOns.map((a) => escapeHtml(textoExtra(a))).join("<br>"))
      : "";

  /*
   * Va en todos los emails, no solo en el aviso a la profesional: en el
   * recordatorio del día antes es justo lo que necesita para salir de casa, y
   * a la clienta le sirve para detectar que se equivocó al escribirla.
   */
  const address =
    siteConfig.venue.needsClientAddress && booking.client_address
      ? row("Dirección", escapeHtml(booking.client_address).replace(/\n/g, "<br>"))
      : "";

  /*
   * El desplazamiento va desglosado y no escondido dentro del total: es un
   * importe que la clienta no esperaba al mirar la tarifa de servicios, y
   * verlo con su nombre evita la conversación de "¿por qué son 5 € más?".
   */
  const zona = booking.zone_name
    ? row(
        "Desplazamiento",
        `${escapeHtml(booking.zone_name)} · ${formatCents(booking.zone_cents)}`,
      )
    : "";

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    ${row("Servicio", escapeHtml(booking.service_name))}
    ${extras}
    ${row("Día", `${escapeHtml(formatDateLong(booking.date))}`)}
    ${row("Hora", `${escapeHtml(booking.start_time)} – ${escapeHtml(booking.end_time)} <span style="font-weight:400;color:${theme.muted};">(${formatDuration(booking.duration_min)})</span>`)}
    ${address}
    ${zona}
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

/*
 * El recuadro de "dónde es", que cambia de sentido según quién se desplace.
 * En un estudio se le dice a la clienta a dónde ir; a domicilio se le devuelve
 * su propia dirección, porque acaba de dárnosla y lo útil es que compruebe que
 * no se equivocó al teclearla.
 */
function wherePanel(booking: BookingRow): string {
  if (!siteConfig.venue.needsClientAddress) {
    return calloutBox(
      `<strong>Dónde es:</strong> ${escapeHtml(business.address.area)}.<br>${escapeHtml(business.address.note)}`,
    );
  }
  const direccion = booking.client_address
    ? escapeHtml(booking.client_address).replace(/\n/g, "<br>")
    : "—";
  return calloutBox(
    `<strong>Voy a:</strong><br>${direccion}<br><span style="color:${theme.muted};">Si algo no está bien, dímelo y lo corrijo.</span>`,
  );
}

function calloutBox(text: string): string {
  return `<div style="margin:20px 0 0;padding:14px 16px;background:${theme.bg};border-left:3px solid ${theme.accent};border-radius:6px;font-size:14px;line-height:1.6;color:${theme.ink};">${text}</div>`;
}

/* -------------------------------------------------------------------------- */
/*  1. Confirmación para la clienta                                           */
/* -------------------------------------------------------------------------- */
export function clientConfirmation(booking: BookingRow, manageUrl: string) {
  const addOns = addOnsOf(booking);
  const depositLine =
    booking.deposit_status === "paid"
      ? `Señal de ${formatCents(booking.deposit_cents)} pagada. Se descuenta del precio final: ${siteConfig.venue.payWhere} quedarían ${formatCents(Math.max(0, booking.price_cents - booking.deposit_cents))}${booking.price_from ? " o más, según el diseño" : ""}.`
      : booking.deposit_status === "on_site"
        ? `Pagarás el importe completo ${siteConfig.venue.payWhere} (efectivo o Bizum).`
        : "";

  const body = `
    ${detailsTable(booking)}
    ${depositLine ? calloutBox(depositLine) : ""}
    ${wherePanel(booking)}
    ${button(manageUrl, "Ver o cancelar mi cita")}
    <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:${theme.muted};">
      Puedes cancelar sin coste hasta ${siteConfig.booking.cancellationHours} h antes desde ese enlace.
      Si necesitas cambiar la hora o tienes dudas del diseño, ${escapeHtml(contactSentence())}.
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
      // El texto plano también: hay quien lo lee así, y un extra por uña puede
      // ser la mitad de la factura.
      addOns.length ? `Extras: ${addOns.map(textoExtra).join(', ')}` : '',
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
              : `Sin señal: paga el total ${siteConfig.venue.payWhere}.`,
          )
        : ""
    }
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
      siteConfig.venue.needsClientAddress && booking.client_address
        ? `Dirección: ${booking.client_address.replace(/\n/g, ", ")}`
        : "",
      `Servicio: ${booking.service_name}`,
      addOns.length ? `Extras: ${addOns.map(textoExtra).join(', ')}` : '',
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
    ${wherePanel(booking)}
    <p style="margin:20px 0 0;font-size:14px;line-height:1.7;color:${theme.ink};">
      <strong>Recuerda:</strong><br>
      ${siteConfig.content.policies.map((p) => `· ${escapeHtml(p)}`).join("<br>")}
    </p>
    ${button(manageUrl, "Ver mi cita")}
    <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:${theme.muted};">
      Si no puedes venir, avisa cuanto antes (${escapeHtml(contactSentence())}) para poder dar el hueco a otra persona.
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
export function cancellationNotice(booking: BookingRow, forOwner: boolean, tarde = false) {
  const refundLine =
    booking.deposit_status === "paid"
      ? forOwner
        ? `Había una señal de ${formatCents(booking.deposit_cents)} pagada: revisa si toca devolverla.`
        : `${deposit.note}`
      : "";

  /*
   * Cuando cancela fuera de plazo, este correo es el justificante de lo que se
   * le va a cobrar, así que lleva la cifra. A la profesional se le dice además
   * que el cobro no es automático: lo lanza ella desde el panel, y así puede
   * perdonarlo si la clienta tenía un motivo.
   */
  const importe = noShowCents(booking);
  const lateLine =
    tarde && importe > 0
      ? forOwner
        ? `Ha cancelado con menos de ${siteConfig.booking.cancellationHours} h. Puedes cobrarle ${formatCents(importe)} desde el panel, en la ficha de la cita. No se cobra solo.`
        : `Has cancelado con menos de ${siteConfig.booking.cancellationHours} h de antelación, así que se te cobrarán <strong>${formatCents(importe)}</strong> a la tarjeta que dejaste al reservar.`
      : "";

  const body = `
    ${detailsTable(booking)}
    ${lateLine ? calloutBox(lateLine) : ""}
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
      // Sin etiquetas: el aviso del cargo también tiene que estar aquí, porque
      // hay quien lee el correo en texto plano y es la parte que cuesta dinero.
      tarde && importe > 0
        ? forOwner
          ? `Cancelación tardía: puedes cobrarle ${formatCents(importe)} desde el panel.`
          : `Cancelación con menos de ${siteConfig.booking.cancellationHours} h: se te cobrarán ${formatCents(importe)}.`
        : "",
      refundLine,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

/* -------------------------------------------------------------------------- */
/*  5. Pendiente de pago (si abandona el checkout)                            */
/* -------------------------------------------------------------------------- */
export function pendingPaymentNotice(booking: BookingRow, payUrl: string) {
  /*
   * Este correo sirve para dos casos que la clienta vive muy distinto: pagar
   * una señal, o registrar la tarjeta sin que se le cobre nada. Decirle
   * "falta la señal" cuando reservar es gratis la asustaría para nada.
   */
  const cobraSenal = booking.deposit_cents > 0;

  const aviso = cobraSenal
    ? `Tu hueco está guardado pero <strong>la cita no queda confirmada</strong> hasta que se abone la señal de ${formatCents(booking.deposit_cents)}.`
    : `Tu hueco está guardado pero <strong>la cita no queda confirmada</strong> hasta que registres una tarjeta. <strong>No se te cobra nada ahora:</strong> solo queda guardada por si no puedes venir, y en ese caso se cobrarían ${formatCents(noShowCents(booking))}.`;

  const body = `
    ${detailsTable(booking)}
    ${calloutBox(aviso)}
    ${button(payUrl, cobraSenal ? `Pagar la señal (${formatCents(booking.deposit_cents)})` : "Registrar mi tarjeta")}`;

  return {
    subject: `Termina tu reserva · ${formatDateLong(booking.date)} a las ${booking.start_time}`,
    html: shell({
      preheader: cobraSenal
        ? "Falta la señal para confirmar tu cita."
        : "Falta registrar la tarjeta para confirmar tu cita.",
      heading: "Falta un paso",
      intro: cobraSenal
        ? "Te he guardado el hueco, pero queda pendiente la señal para confirmarlo."
        : "Te he guardado el hueco. Para confirmarlo solo falta registrar una tarjeta; no se te cobra nada.",
      body,
      accentBar: theme.accent,
    }),
    text: [
      `Reserva pendiente en ${business.name}`,
      `Día: ${formatDateLong(booking.date)} ${booking.start_time}`,
      cobraSenal
        ? `Falta pagar la señal de ${formatCents(booking.deposit_cents)}: ${payUrl}`
        : `Falta registrar la tarjeta (no se te cobra nada ahora): ${payUrl}`,
    ].join("\n"),
  };
}

/* -------------------------------------------------------------------------- */
/*  6. Enlace a "Mis citas"                                                   */
/* -------------------------------------------------------------------------- */

/*
 * No lleva ningún dato de las citas: solo el enlace. Así, si el correo acaba
 * en una bandeja compartida o se reenvía sin querer, no se ha filtrado nada
 * por el camino, y el enlace además caduca a las 72 h.
 */
export function clientPortalLink(url: string) {
  const body = `
    ${calloutBox("El enlace vale durante 72 horas. Pasado ese rato, pídelo otra vez desde la web.")}
    ${button(url, "Ver mis citas")}`;

  return {
    subject: `Tus citas en ${business.name}`,
    html: shell({
      preheader: "Tu enlace para ver y gestionar tus citas.",
      heading: "Aquí tienes tus citas",
      intro:
        "Desde este enlace puedes ver tu próxima cita, las anteriores, y cancelar si lo necesitas.",
      body,
      accentBar: theme.accent,
    }),
    text: [
      `Tus citas en ${business.name}`,
      ``,
      `Entra aquí para verlas y gestionarlas: ${url}`,
      `El enlace caduca en 72 horas.`,
    ].join("\n"),
  };
}

/* -------------------------------------------------------------------------- */
/*  7. Código de verificación                                                 */
/* -------------------------------------------------------------------------- */

/*
 * El código va grande y en el asunto, porque se lee en el móvil con la web
 * abierta al lado y lo normal es no llegar a abrir el correo entero.
 */
export function verificationCode(codigo: string) {
  const body = `
    <div style="margin:24px 0;padding:20px;background:${theme.bg};border-radius:10px;text-align:center;">
      <p style="margin:0 0 8px;font-size:13px;color:${theme.muted};">Tu código</p>
      <p style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:34px;letter-spacing:.22em;font-weight:600;color:${theme.ink};">${escapeHtml(codigo)}</p>
    </div>
    ${calloutBox("Caduca en 10 minutos y solo sirve una vez. Si no has sido tú, puedes ignorar este correo: sin el código no se puede hacer nada.")}`;

  return {
    subject: `${codigo} · tu código para reservar en ${business.name}`,
    html: shell({
      preheader: `Tu código es ${codigo}.`,
      heading: "Tu código de verificación",
      intro: "Escríbelo en la web para recuperar tus datos y no tener que rellenarlos otra vez.",
      body,
      accentBar: theme.accent,
    }),
    text: [
      `Tu código para ${business.name}: ${codigo}`,
      ``,
      `Caduca en 10 minutos y solo sirve una vez.`,
      `Si no has sido tú, ignora este correo.`,
    ].join("\n"),
  };
}

/* -------------------------------------------------------------------------- */
/*  8. La cita ha cambiado de hora                                            */
/* -------------------------------------------------------------------------- */

/*
 * Cuando es la profesional quien mueve una cita, la clienta tiene que
 * enterarse sí o sí: se ha organizado el día alrededor de esa hora. Por eso
 * lleva delante la fecha vieja y la nueva, no solo la nueva.
 */
export function bookingMoved(booking: BookingRow, antes: { date: string; start_time: string }, manageUrl: string) {
  const body = `
    ${calloutBox(
      `<strong>Antes:</strong> ${escapeHtml(formatDateLong(antes.date))} a las ${escapeHtml(antes.start_time)}<br>` +
        `<strong>Ahora:</strong> ${escapeHtml(formatDateLong(booking.date))} a las ${escapeHtml(booking.start_time)}`,
    )}
    ${detailsTable(booking)}
    ${wherePanel(booking)}
    ${button(manageUrl, "Ver mi cita")}
    <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:${theme.muted};">
      Si esa hora no te viene bien, ${escapeHtml(contactSentence())} y buscamos otra.
    </p>`;

  return {
    subject: `Tu cita cambia al ${formatDateLong(booking.date)} a las ${booking.start_time}`,
    html: shell({
      preheader: `Tu cita se mueve al ${formatDateLong(booking.date)} a las ${booking.start_time}.`,
      heading: "He movido tu cita",
      intro: "He tenido que cambiarte la hora. Aquí tienes el nuevo día, y perdona las molestias.",
      body,
      accentBar: theme.accent,
    }),
    text: [
      `Tu cita en ${business.name} ha cambiado de hora`,
      ``,
      `Antes: ${formatDateLong(antes.date)} a las ${antes.start_time}`,
      `Ahora: ${formatDateLong(booking.date)} a las ${booking.start_time}`,
      ``,
      `Ver la cita: ${manageUrl}`,
    ].join("\n"),
  };
}
