import { randomBytes } from "node:crypto";
import siteConfig from "@config";
import { isSlotBookable } from "@/lib/availability";
import { nombreDe, quote, type AddOnPick } from "@/lib/catalog";
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
  markPolicyAccepted,
  markReminderSent,
  saveCardOnFile,
  updateBookingStatus,
  type BookingRow,
} from "@/lib/db";
import { isStripeConfigured, type SavedCard } from "@/lib/payments";
import {
  cancellationNotice,
  clientConfirmation,
  clientReminder,
  ownerNotification,
  pendingPaymentNotice,
} from "@/lib/mail/templates";
import { sendAll, type Mail } from "@/lib/mail/send";
import { adminUrl, manageUrl, payUrl } from "@/lib/urls";
import { ownerEmail } from "@/lib/business";
import { contactSentence } from "@/lib/business";

export type PaymentChoice = "deposit" | "on_site";

export type CreateBookingInput = {
  /** Uno o varios: una cita puede ser retirada + acrílicas, o manos y pies. */
  serviceIds: string[];
  addOns: AddOnPick[];
  date: string;
  time: string;
  name: string;
  email: string;
  phone: string;
  /** Dónde vive la clienta. Obligatorio si es la profesional quien se desplaza. */
  address?: string;
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
  /*
   * Cuando es la profesional quien se desplaza, la dirección no es un extra:
   * sin ella la cita no se puede atender. Se valida aquí, en el servidor, y no
   * solo en el formulario, porque el navegador puede saltárselo.
   */
  if (siteConfig.venue.needsClientAddress && (input.address ?? "").trim().length < 8) {
    return {
      error: "Necesito la dirección completa para poder ir: calle, número y población.",
      field: "address",
    };
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
  const q = quote(input.serviceIds, input.addOns);
  if (!q) return { ok: false, error: "Ese servicio ya no está disponible.", field: "serviceId" };

  const slotCheck = await isSlotBookable(input.date, input.time, q.durationMin);
  if (!slotCheck.ok) return { ok: false, error: slotCheck.reason, field: "time" };

  const wantsDeposit =
    siteConfig.deposit.enabled && q.depositCents > 0 && input.payment === "deposit";

  /*
   * Sin señal pero con política de plantones, la clienta tiene que pasar igual
   * por Stripe: no para pagar —reservar es gratis— sino para dejar la tarjeta.
   * Y hasta que la deja, la cita NO se confirma: si se confirmara antes, quien
   * abandonase esa pantalla tendría el hueco cogido sin nada que respaldarlo,
   * que es exactamente el plantón contra el que se está protegiendo.
   */
  const needsCard = !wantsDeposit && siteConfig.noShow.enabled && isStripeConfigured();
  const needsCheckout = wantsDeposit || needsCard;

  const code = newCode();
  const token = randomBytes(16).toString("hex");

  const row = {
    code,
    created_at: new Date().toISOString(),
    status: (needsCheckout ? "pending_payment" : "confirmed") as BookingRow["status"],
    /* El primero, solo para poder filtrar; el nombre lleva todos. */
    service_id: q.services[0].id,
    service_name: nombreDe(q.services),
    category_name: q.services[0].categoryName,
    /*
     * Se guarda lo que costaba cada servicio HOY. Si mañana ella sube la
     * tarifa, esta cita tiene que seguir contando por lo que se cobró.
     */
    services_json: JSON.stringify(
      q.services.map((s) => ({
        id: s.id,
        name: s.name,
        price: s.price,
        durationMin: s.durationMin,
        categoryName: s.categoryName,
      })),
    ),
    addons_json: JSON.stringify(
      q.addOns.map((a) => ({ name: a.name, price: a.price, units: a.units })),
    ),
    price_cents: q.totalCents,
    price_from: q.isFrom ? 1 : 0,
    duration_min: q.durationMin,
    date: input.date,
    start_time: input.time,
    end_time: endTime(input.time, q.durationMin),
    client_name: input.name.trim(),
    client_email: input.email.trim().toLowerCase(),
    client_phone: input.phone.trim(),
    client_address: (input.address ?? "").trim().slice(0, 300),
    notes: (input.notes ?? "").trim().slice(0, 800),
    deposit_cents: wantsDeposit ? q.depositCents : 0,
    deposit_status: (wantsDeposit ? "pending" : "on_site") as BookingRow["deposit_status"],
    payment_ref: null,
    manage_token: token,
  };

  await insertBooking(row);

  /*
   * Sin constancia de que aceptó la política no se le puede cobrar un plantón,
   * así que se guarda la fecha en el mismo momento de crear la reserva. El
   * texto exacto que aceptó vive en la configuración (noShow.terms).
   */
  if (siteConfig.noShow.enabled) {
    await markPolicyAccepted(code, new Date().toISOString());
  }

  const booking = await getBooking(code);
  if (!booking) return { ok: false, error: "No se pudo guardar la reserva. Inténtalo de nuevo." };

  const links = { manage: manageUrl(code, token), pay: payUrl(code, token) };

  if (needsCheckout) {
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

  return { ok: true, booking, needsPayment: needsCheckout, manageUrl: links.manage, payUrl: links.pay };
}

/** Confirmación a la clienta + aviso a la profesional. */
export async function notifyConfirmed(booking: BookingRow) {
  const manage = manageUrl(booking.code, booking.manage_token);
  const forClient = clientConfirmation(booking, manage);
  const forOwner = ownerNotification(booking, adminUrl());

  const mails: Mail[] = [
    { to: booking.client_email, kind: "client_confirmation", bookingCode: booking.code, ...forClient },
    {
      to: ownerEmail(),
      kind: "owner_notification",
      bookingCode: booking.code,
      // Que al responder le escriba a la clienta, no a sí misma.
      replyTo: booking.client_email,
      ...forOwner,
    },
  ];
  return sendAll(mails);
}

/* -------------------------------------------------------------------------- */
/*  Pago de la señal                                                          */
/* -------------------------------------------------------------------------- */
export async function confirmDeposit(code: string, paymentRef: string, card?: SavedCard) {
  const before = await getBooking(code);
  if (!before) return { ok: false as const, error: "Reserva no encontrada." };
  if (before.deposit_status === "paid") {
    // Idempotente: Stripe puede reintentar el webhook y no queremos duplicar emails.
    return { ok: true as const, booking: before, alreadyPaid: true };
  }

  /*
   * La tarjeta se guarda antes que nada. Si esto se hiciera después de marcar
   * la señal como pagada y fallase, quedaría una reserva confirmada sin tarjeta
   * y la política de plantones no se podría aplicar sin que nadie lo notara.
   */
  if (card) {
    await saveCardOnFile(code, card.customerId, card.paymentMethodId, card.label);
  }

  /*
   * Si no había señal que cobrar, no se marca ninguna como pagada: solo se
   * confirma la cita. Marcarla dejaría constancia de un cobro que no existió y
   * la clienta vería "señal pagada: 0 €" en su email.
   */
  if (before.deposit_cents > 0) {
    await markDepositPaid(code, paymentRef);
  } else {
    await updateBookingStatus(code, "confirmed");
  }
  const booking = (await getBooking(code))!;
  await notifyConfirmed(booking);
  return { ok: true as const, booking, alreadyPaid: false };
}

/* -------------------------------------------------------------------------- */
/*  Cancelación                                                               */
/* -------------------------------------------------------------------------- */
export async function cancelBooking(code: string, token: string) {
  const booking = await getBooking(code);
  if (!booking) return { ok: false as const, error: "Esa reserva no existe." };
  if (booking.manage_token !== token) {
    return { ok: false as const, error: "El enlace no es válido." };
  }
  if (booking.status === "cancelled") {
    return { ok: true as const, booking, alreadyCancelled: true };
  }

  const remaining = hoursUntil(booking.date, booking.start_time);

  /*
   * Cancelar tarde SÍ se permite. Antes se bloqueaba, y el efecto era el
   * contrario del que se buscaba: la clienta que sabía que no iba a poder ir se
   * encontraba una puerta cerrada, no avisaba, y el hueco se perdía igual sin
   * que nadie se enterara hasta la hora de la cita. Es mejor que avise, aunque
   * sea tarde, y que sepa lo que le cuesta al pulsar el botón.
   *
   * La cita ya pasada es otra cosa: ahí no hay nada que cancelar.
   */
  if (remaining < 0) {
    return {
      ok: false as const,
      error: `Esa cita ya ha pasado. Si necesitas algo, ${contactSentence()}.`,
    };
  }

  const tarde = remaining < siteConfig.booking.cancellationHours;

  await updateBookingStatus(code, "cancelled");
  const cancelled = (await getBooking(code))!;

  await sendAll([
    {
      to: cancelled.client_email,
      kind: "cancellation_client",
      bookingCode: code,
      ...cancellationNotice(cancelled, false, tarde),
    },
    {
      to: ownerEmail(),
      kind: "cancellation_owner",
      bookingCode: code,
      replyTo: cancelled.client_email,
      ...cancellationNotice(cancelled, true, tarde),
    },
  ]);

  return { ok: true as const, booking: cancelled, alreadyCancelled: false, tarde };
}

/* -------------------------------------------------------------------------- */
/*  Recordatorios del día antes                                               */
/* -------------------------------------------------------------------------- */
export async function sendRemindersForTomorrow() {
  const tomorrow = addDays(nowInBusinessTz().date, 1);
  return sendRemindersFor(tomorrow);
}

export async function sendRemindersFor(date: string) {
  const pending = await bookingsNeedingReminder(date);
  const sent: string[] = [];

  for (const booking of pending) {
    const mail = clientReminder(booking, manageUrl(booking.code, booking.manage_token));
    const [result] = await sendAll([
      { to: booking.client_email, kind: "client_reminder", bookingCode: booking.code, ...mail },
    ]);
    // Solo se marca si salió bien, para que el siguiente intento lo reintente.
    if (result.ok) {
      await markReminderSent(booking.code);
      sent.push(booking.code);
    }
  }

  return { date, found: pending.length, sent };
}
