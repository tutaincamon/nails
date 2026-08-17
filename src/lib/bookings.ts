import { randomBytes } from "node:crypto";
import siteConfig from "@config";
import { isSlotBookable } from "@/lib/availability";
import { quote } from "@/lib/catalog";
import {
  addDays,
  endTime,
  hoursUntil,
  nowInBusinessTz,
} from "@/lib/time";
import {
  bookingsNeedingReminder,
  getBooking,
  insertBooking,
  markDepositPaid,
  markReminderSent,
  updateBookingStatus,
  type BookingRow,
} from "@/lib/db";
import {
  cancellationNotice,
  clientConfirmation,
  clientReminder,
  ownerNotification,
  pendingPaymentNotice,
} from "@/lib/mail/templates";
import { sendAll, type Mail } from "@/lib/mail/send";
import { adminUrl, manageUrl, payUrl } from "@/lib/urls";

export type PaymentChoice = "deposit" | "on_site";

export type CreateBookingInput = {
  serviceId: string;
  addOnIds: string[];
  date: string;
  time: string;
  name: string;
  email: string;
  phone: string;
  notes?: string;
  payment: PaymentChoice;
};

export type CreateBookingResult =
  | {
      ok: true;
      booking: BookingRow;
      /** true si falta pagar la señal para que la cita quede confirmada. */
      needsPayment: boolean;
      manageUrl: string;
      payUrl: string;
    }
  | { ok: false; error: string; field?: string };

/** Código corto legible por teléfono: "AUR-4K7P2M". */
function newCode(): string {
  const prefix = siteConfig.business.shortName
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "X");
  // Sin vocales ni caracteres ambiguos (0/O, 1/I) para dictarlo sin errores.
  const alphabet = "23456789BCDFGHJKLMNPQRSTVWXZ";
  let body = "";
  for (const byte of randomBytes(6)) body += alphabet[byte % alphabet.length];
  return `${prefix}-${body}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

function validateClient(input: CreateBookingInput): { error: string; field: string } | null {
  if (input.name.trim().length < 2) {
    return { error: "Escribe tu nombre para poder identificar la cita.", field: "name" };
  }
  if (!EMAIL_RE.test(input.email.trim())) {
    return { error: "Ese email no parece válido: ahí te enviaré la confirmación.", field: "email" };
  }
  const digits = input.phone.replace(/\D/g, "");
  if (digits.length < 9) {
    return { error: "Necesito un teléfono válido por si tengo que avisarte.", field: "phone" };
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*  Crear reserva                                                             */
/* -------------------------------------------------------------------------- */
export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const invalid = validateClient(input);
  if (invalid) return { ok: false, error: invalid.error, field: invalid.field };

  // El precio y la duración se recalculan siempre en el servidor: lo que llega
  // del navegador solo se usa para saber QUÉ se ha elegido, nunca cuánto vale.
  const q = quote(input.serviceId, input.addOnIds);
  if (!q) return { ok: false, error: "Ese servicio ya no está disponible.", field: "serviceId" };

  const slotCheck = isSlotBookable(input.date, input.time, q.durationMin);
  if (!slotCheck.ok) return { ok: false, error: slotCheck.reason, field: "time" };

  const wantsDeposit =
    siteConfig.deposit.enabled && q.depositCents > 0 && input.payment === "deposit";

  const code = newCode();
  const token = randomBytes(16).toString("hex");

  const row = {
    code,
    created_at: new Date().toISOString(),
    status: (wantsDeposit ? "pending_payment" : "confirmed") as BookingRow["status"],
    service_id: q.service.id,
    service_name: q.service.name,
    category_name: q.service.categoryName,
    addons_json: JSON.stringify(q.addOns.map((a) => ({ name: a.name, price: a.price }))),
    price_cents: q.totalCents,
    price_from: q.isFrom ? 1 : 0,
    duration_min: q.durationMin,
    date: input.date,
    start_time: input.time,
    end_time: endTime(input.time, q.durationMin),
    client_name: input.name.trim(),
    client_email: input.email.trim().toLowerCase(),
    client_phone: input.phone.trim(),
    notes: (input.notes ?? "").trim().slice(0, 800),
    deposit_cents: wantsDeposit ? q.depositCents : 0,
    deposit_status: (wantsDeposit ? "pending" : "on_site") as BookingRow["deposit_status"],
    payment_ref: null,
    manage_token: token,
  };

  insertBooking(row);
  const booking = getBooking(code);
  if (!booking) return { ok: false, error: "No se pudo guardar la reserva. Inténtalo de nuevo." };

  const links = { manage: manageUrl(code, token), pay: payUrl(code, token) };

  if (wantsDeposit) {
    // Aún no está confirmada: solo se avisa a la clienta de que falta la señal.
    const pending = pendingPaymentNotice(booking, links.pay);
    await sendAll([
      {
        to: booking.client_email,
        kind: "pending_payment",
        bookingCode: code,
        ...pending,
      },
    ]);
  } else {
    await notifyConfirmed(booking);
  }

  return { ok: true, booking, needsPayment: wantsDeposit, manageUrl: links.manage, payUrl: links.pay };
}

/** Confirmación a la clienta + aviso a la profesional. */
export async function notifyConfirmed(booking: BookingRow) {
  const manage = manageUrl(booking.code, booking.manage_token);
  const forClient = clientConfirmation(booking, manage);
  const forOwner = ownerNotification(booking, adminUrl());

  const mails: Mail[] = [
    { to: booking.client_email, kind: "client_confirmation", bookingCode: booking.code, ...forClient },
    {
      to: siteConfig.business.ownerEmail,
      kind: "owner_notification",
      bookingCode: booking.code,
      ...forOwner,
    },
  ];
  return sendAll(mails);
}

/* -------------------------------------------------------------------------- */
/*  Pago de la señal                                                          */
/* -------------------------------------------------------------------------- */
export async function confirmDeposit(code: string, paymentRef: string) {
  const before = getBooking(code);
  if (!before) return { ok: false as const, error: "Reserva no encontrada." };
  if (before.deposit_status === "paid") {
    // Idempotente: Stripe puede reintentar el webhook y no queremos duplicar emails.
    return { ok: true as const, booking: before, alreadyPaid: true };
  }

  markDepositPaid(code, paymentRef);
  const booking = getBooking(code)!;
  await notifyConfirmed(booking);
  return { ok: true as const, booking, alreadyPaid: false };
}

/* -------------------------------------------------------------------------- */
/*  Cancelación                                                               */
/* -------------------------------------------------------------------------- */
export async function cancelBooking(code: string, token: string) {
  const booking = getBooking(code);
  if (!booking) return { ok: false as const, error: "Esa reserva no existe." };
  if (booking.manage_token !== token) {
    return { ok: false as const, error: "El enlace no es válido." };
  }
  if (booking.status === "cancelled") {
    return { ok: true as const, booking, alreadyCancelled: true };
  }

  const remaining = hoursUntil(booking.date, booking.start_time);
  if (remaining < siteConfig.booking.cancellationHours) {
    return {
      ok: false as const,
      error: `Ya no se puede cancelar online (quedan menos de ${siteConfig.booking.cancellationHours} h). Escríbeme por WhatsApp al ${siteConfig.business.phone} y lo vemos.`,
    };
  }

  updateBookingStatus(code, "cancelled");
  const cancelled = getBooking(code)!;

  await sendAll([
    {
      to: cancelled.client_email,
      kind: "cancellation_client",
      bookingCode: code,
      ...cancellationNotice(cancelled, false),
    },
    {
      to: siteConfig.business.ownerEmail,
      kind: "cancellation_owner",
      bookingCode: code,
      ...cancellationNotice(cancelled, true),
    },
  ]);

  return { ok: true as const, booking: cancelled, alreadyCancelled: false };
}

/* -------------------------------------------------------------------------- */
/*  Recordatorios del día antes                                               */
/* -------------------------------------------------------------------------- */
export async function sendRemindersForTomorrow() {
  const tomorrow = addDays(nowInBusinessTz().date, 1);
  return sendRemindersFor(tomorrow);
}

export async function sendRemindersFor(date: string) {
  const pending = bookingsNeedingReminder(date);
  const sent: string[] = [];

  for (const booking of pending) {
    const mail = clientReminder(booking, manageUrl(booking.code, booking.manage_token));
    const [result] = await sendAll([
      { to: booking.client_email, kind: "client_reminder", bookingCode: booking.code, ...mail },
    ]);
    // Solo se marca si salió bien, para que el siguiente intento lo reintente.
    if (result.ok) {
      markReminderSent(booking.code);
      sent.push(booking.code);
    }
  }

  return { date, found: pending.length, sent };
}
