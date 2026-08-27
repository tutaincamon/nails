"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import siteConfig from "@config";
import type { BlockRow, BookingRow, BookingStatus, WeeklyHours } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { addDays, formatDateLong, formatDuration } from "@/lib/time";
import { StatusBadge, capitalize, parseAddOns } from "@/components/BookingDetails";
import { StatsPanel } from "@/components/admin/StatsPanel";
import type { Stats } from "@/lib/stats";

type EmailSummary = {
  id: number;
  created_at: string;
  to_addr: string;
  subject: string;
  kind: string;
  transport: string;
  booking_code: string | null;
  error: string | null;
};

type Props = {
  today: string;
  stats: Stats;
  bookings: BookingRow[];
  blocks: BlockRow[];
  /** Horario que rige ahora mismo: el guardado aquí, o el de la configuración. */
  hours: WeeklyHours;
  /** true si se ha editado desde el panel (y por tanto se puede deshacer). */
  hoursAreCustom: boolean;
  emails: EmailSummary[];
  mailMode: "real" | "simulado";
  paymentMode: "stripe" | "demo";
  usingDefaultPassword: boolean;
};

type Tab = "resumen" | "proximas" | "historico" | "horario" | "agenda" | "emails";

const TABS: { id: Tab; label: string }[] = [
  { id: "resumen", label: "Resumen" },
  { id: "proximas", label: "Próximas citas" },
  { id: "historico", label: "Histórico" },
  { id: "horario", label: "Mi horario" },
  { id: "agenda", label: "Bloquear horas" },
  { id: "emails", label: "Emails" },
];

export function AdminDashboard(props: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("resumen");
  const [notice, setNotice] = useState<string | null>(null);

  const upcoming = useMemo(
    () =>
      props.bookings
        .filter((b) => b.date >= props.today && b.status !== "cancelled")
        .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time)),
    [props.bookings, props.today],
  );

  const history = useMemo(
    () => props.bookings.filter((b) => b.date < props.today || b.status === "cancelled"),
    [props.bookings, props.today],
  );

  const revenue = upcoming.reduce((sum, b) => sum + b.price_cents, 0);
  const depositsHeld = upcoming
    .filter((b) => b.deposit_status === "paid")
    .reduce((sum, b) => sum + b.deposit_cents, 0);

  async function logout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    router.refresh();
  }

  async function sendReminders() {
    setNotice(null);
    const response = await fetch("/api/cron/reminders", { method: "POST" });
    const data = (await response.json()) as {
      ok: boolean;
      date?: string;
      found?: number;
      sent?: string[];
      error?: string;
    };
    if (!data.ok) {
      setNotice(data.error ?? "No se pudieron enviar los recordatorios.");
      return;
    }
    setNotice(
      data.sent && data.sent.length > 0
        ? `Recordatorios enviados: ${data.sent.length} de ${data.found} citas del ${data.date}.`
        : `No había recordatorios pendientes para el ${data.date}.`,
    );
    router.refresh();
  }

  return (
    <div className="section py-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="eyebrow">{siteConfig.business.name}</p>
          <h1 className="mt-1 text-[2rem]">Agenda</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {upcoming.length} cita{upcoming.length === 1 ? "" : "s"} por delante ·{" "}
            {formatCents(revenue)} previstos
            {depositsHeld > 0 && ` · ${formatCents(depositsHeld)} ya cobrados en señales`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost btn-sm" onClick={sendReminders}>
            Enviar recordatorios de mañana
          </button>
          <Link href="/" className="btn-ghost btn-sm">
            Ver la web
          </Link>
          <button type="button" className="btn-ghost btn-sm" onClick={logout}>
            Salir
          </button>
        </div>
      </header>

      <ModeBanner
        mailMode={props.mailMode}
        paymentMode={props.paymentMode}
        usingDefaultPassword={props.usingDefaultPassword}
      />

      {notice && (
        <p className="mt-4 border border-line bg-surface px-4 py-3 text-[14px] text-ink">
          {notice}
        </p>
      )}

      <nav className="mt-6 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`btn-sm border ${
              tab === item.id
                ? "border-primary bg-primary text-white"
                : "border-line bg-surface text-muted hover:border-primary hover:text-primary"
            }`}
          >
            {item.label}
            {item.id === "emails" && props.emails.length > 0 && (
              <span className="ml-1.5 opacity-70">{props.emails.length}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="mt-6">
        {tab === "resumen" && <StatsPanel stats={props.stats} />}
        {tab === "proximas" && <BookingList bookings={upcoming} emptyText="No hay citas próximas." />}
        {tab === "historico" && (
          <BookingList bookings={history} emptyText="Todavía no hay histórico." />
        )}
        {tab === "horario" && (
          <ScheduleTab hours={props.hours} isCustom={props.hoursAreCustom} />
        )}
        {tab === "agenda" && <BlocksTab blocks={props.blocks} today={props.today} />}
        {tab === "emails" && <EmailsTab emails={props.emails} mailMode={props.mailMode} />}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ModeBanner({
  mailMode,
  paymentMode,
  usingDefaultPassword,
}: {
  mailMode: "real" | "simulado";
  paymentMode: "stripe" | "demo";
  usingDefaultPassword: boolean;
}) {
  const warnings = [
    mailMode === "simulado" &&
      "Emails en modo simulado: no salen a internet, se leen en la pestaña Emails. Para enviarlos de verdad, configura SMTP_HOST y SMTP_USER (lo más rápido) o RESEND_API_KEY con dominio propio.",
    paymentMode === "demo" &&
      "Cobros en modo demostración: no se piden datos de tarjeta. Añade STRIPE_SECRET_KEY para cobrar con Stripe.",
    usingDefaultPassword &&
      "Este panel usa la contraseña de ejemplo. Configura ADMIN_PASSWORD antes de publicar la web.",
  ].filter(Boolean) as string[];

  if (warnings.length === 0) return null;

  return (
    <ul className="mt-5 space-y-2">
      {warnings.map((warning) => (
        <li
          key={warning}
          className="border border-dashed border-accent bg-surface px-4 py-3 text-[13px] leading-relaxed text-muted"
        >
          {warning}
        </li>
      ))}
    </ul>
  );
}

function BookingList({ bookings, emptyText }: { bookings: BookingRow[]; emptyText: string }) {
  if (bookings.length === 0) {
    return (
      <p className="border border-line bg-surface px-5 py-10 text-center text-[14px] text-muted">
        {emptyText}
      </p>
    );
  }

  const byDate = bookings.reduce<Record<string, BookingRow[]>>((acc, booking) => {
    (acc[booking.date] ??= []).push(booking);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {Object.entries(byDate).map(([date, dayBookings]) => (
        <section key={date}>
          <h2 className="text-[15px] font-semibold text-ink">{capitalize(formatDateLong(date))}</h2>
          <ul className="mt-3 space-y-3">
            {dayBookings.map((booking) => (
              <BookingCard key={booking.code} booking={booking} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function BookingCard({ booking }: { booking: BookingRow }) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [noShowError, setNoShowError] = useState<string | null>(null);
  const addOns = parseAddOns(booking.addons_json);

  async function setStatus(status: BookingStatus) {
    setWorking(true);
    await fetch(`/api/admin/bookings/${encodeURIComponent(booking.code)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setWorking(false);
    router.refresh();
  }

  /*
   * Se puede cobrar si la cita ya pasó (no se presentó) o si la canceló ella
   * fuera de plazo: en ese caso el hueco ya está perdido aunque la fecha no
   * haya llegado. Una cita futura que sigue en pie no se cobra.
   */
  const isPast = new Date(`${booking.date}T${booking.end_time}`) < new Date();
  const horasParaLaCita =
    (new Date(`${booking.date}T${booking.start_time}`).getTime() - Date.now()) / 3_600_000;
  const canceladaTarde =
    booking.status === "cancelled" && horasParaLaCita < siteConfig.booking.cancellationHours;
  const sePuedeCobrar = isPast || canceladaTarde;

  async function chargeNoShow() {
    const percent = siteConfig.noShow.chargePercent;
    const amount = Math.round((booking.price_cents * percent) / 100) - booking.deposit_cents;
    const confirmed = window.confirm(
      `Se va a cobrar ${formatCents(amount)} a la tarjeta de ${booking.client_name} ` +
        `(${booking.card_label}) por no acudir a la cita del ${booking.date}.\n\n` +
        `Esto cobra dinero de verdad y no se puede deshacer desde aquí.`,
    );
    if (!confirmed) return;

    setWorking(true);
    setNoShowError(null);
    const response = await fetch("/api/admin/no-show", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: booking.code }),
    });
    const data = (await response.json()) as { ok: boolean; error?: string };
    setWorking(false);
    if (!data.ok) {
      setNoShowError(data.error ?? "No se pudo cobrar.");
      return;
    }
    router.refresh();
  }

  return (
    <li className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-ink">
            {booking.start_time}–{booking.end_time}{" "}
            <span className="font-normal text-muted">
              · {formatDuration(booking.duration_min)}
            </span>
          </p>
          <p className="mt-0.5 font-display text-[18px] leading-snug text-ink">
            {booking.service_name}
          </p>
          {addOns.length > 0 && (
            <p className="text-[13px] text-muted">
              + {addOns.map((a) => a.name).join(", ")}
            </p>
          )}
        </div>
        <div className="text-right">
          <StatusBadge status={booking.status} />
          <p className="mt-1.5 text-[15px] font-semibold text-ink">
            {booking.price_from && <span className="text-[12px] font-normal text-muted">desde </span>}
            {formatCents(booking.price_cents)}
          </p>
          {booking.deposit_status === "paid" && (
            <p className="text-[11.5px] text-green-700">
              señal {formatCents(booking.deposit_cents)} cobrada
            </p>
          )}
          {booking.deposit_status === "pending" && (
            <p className="text-[11.5px] text-amber-700">señal sin pagar</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-[13px] text-muted">
        <span className="font-medium text-ink">{booking.client_name}</span>
        <a href={`tel:${booking.client_phone}`} className="hover:text-ink">
          {booking.client_phone}
        </a>
        <a href={`mailto:${booking.client_email}`} className="hover:text-ink">
          {booking.client_email}
        </a>
        <span className="font-mono text-[11.5px] tracking-wide text-muted/70">{booking.code}</span>
        {booking.reminder_sent_at && (
          <span className="text-[11.5px] text-green-700">recordatorio enviado</span>
        )}
      </div>

      {/*
        Para quien va a domicilio, esto es el dato operativo de la tarjeta: sin
        él no sale de casa. Por eso va antes que la nota y más destacado.
      */}
      {siteConfig.venue.needsClientAddress && booking.client_address && (
        <p className="mt-2 border-l-2 border-accent bg-bg px-3 py-2 text-[13px] leading-relaxed text-ink">
          <span className="font-semibold">Dirección:</span> {booking.client_address}
        </p>
      )}

      {booking.notes && (
        <p className="mt-2 bg-bg px-3 py-2 text-[13px] leading-relaxed text-ink">
          <span className="font-semibold">Nota:</span> {booking.notes}
        </p>
      )}

      {/*
        Estado de la tarjeta guardada. Se enseña siempre que la política esté
        activa, también cuando NO hay tarjeta: enterarse de que no la hay justo
        cuando quieres cobrar un plantón es lo peor que puede pasar aquí.
      */}
      {siteConfig.noShow.enabled && (
        <p className="mt-2 text-[12.5px] text-muted">
          {booking.no_show_cents > 0 ? (
            <span className="text-red-700">
              Plantón cobrado: {formatCents(booking.no_show_cents)}
            </span>
          ) : booking.card_label ? (
            <>Tarjeta guardada: {booking.card_label}</>
          ) : (
            <span className="text-amber-700">Sin tarjeta guardada</span>
          )}
        </p>
      )}

      {noShowError && <p className="mt-2 text-[12.5px] text-red-700">{noShowError}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {booking.status !== "completed" && (
          <button
            type="button"
            className="btn-ghost btn-sm"
            disabled={working}
            onClick={() => setStatus("completed")}
          >
            Marcar como realizada
          </button>
        )}
        {/*
          Solo tiene sentido cuando ya pasó la hora y hay tarjeta. Pide
          confirmación porque cobra de verdad y no tiene botón de deshacer.
        */}
        {siteConfig.noShow.enabled &&
          booking.card_label &&
          booking.no_show_cents === 0 &&
          sePuedeCobrar && (
            <button
              type="button"
              className="btn-sm border border-line text-red-700 transition-colors hover:border-red-300 hover:bg-red-50"
              disabled={working}
              onClick={chargeNoShow}
            >
              {canceladaTarde ? "Cobrar cancelación tardía" : "Cobrar por no presentarse"}
            </button>
          )}
        {booking.status === "pending_payment" && (
          <button
            type="button"
            className="btn-ghost btn-sm"
            disabled={working}
            onClick={() => setStatus("confirmed")}
          >
            Confirmar sin señal
          </button>
        )}
        {booking.status !== "cancelled" && (
          <button
            type="button"
            className="btn-sm border border-line text-red-700 transition-colors hover:border-red-300 hover:bg-red-50"
            disabled={working}
            onClick={() => setStatus("cancelled")}
          >
            Cancelar y avisar
          </button>
        )}
      </div>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/*  Mi horario                                                                */
/* -------------------------------------------------------------------------- */

const WEEKDAY_NAMES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
/** De lunes a domingo, que es como se lee una semana. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/*
 * El horario vivía en el código y cambiarlo obligaba a volver a desplegar. Aquí
 * se edita y entra en vigor al guardar.
 *
 * Se trabaja sobre una copia local y solo se manda al servidor al pulsar
 * Guardar: así se puede montar la semana entera —quitar una franja, añadir
 * otra— sin que la web quede a medias mientras tanto.
 */
function ScheduleTab({ hours, isCustom }: { hours: WeeklyHours; isCustom: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<WeeklyHours>(() =>
    Object.fromEntries(
      Array.from({ length: 7 }, (_, day) => [day, (hours[day] ?? []).map((r) => ({ ...r }))]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [working, setWorking] = useState(false);
  const [noShowError, setNoShowError] = useState<string | null>(null);

  function update(day: number, ranges: { start: string; end: string }[]) {
    setDraft({ ...draft, [day]: ranges });
    setSaved(false);
  }

  function addRange(day: number) {
    const existing = draft[day] ?? [];
    // Se propone la franja de tarde más habitual, para no escribirla a mano.
    const suggestion = existing.length === 0
      ? { start: "10:00", end: "14:00" }
      : { start: "16:00", end: "20:00" };
    update(day, [...existing, suggestion]);
  }

  function removeRange(day: number, index: number) {
    update(day, (draft[day] ?? []).filter((_, i) => i !== index));
  }

  function editRange(day: number, index: number, field: "start" | "end", value: string) {
    update(
      day,
      (draft[day] ?? []).map((range, i) => (i === index ? { ...range, [field]: value } : range)),
    );
  }

  /** Copia el horario de un día en todos los demás días laborables. */
  function copyToWeekdays(day: number) {
    const source = (draft[day] ?? []).map((r) => ({ ...r }));
    const next: WeeklyHours = { ...draft };
    for (const target of [1, 2, 3, 4, 5]) next[target] = source.map((r) => ({ ...r }));
    setDraft(next);
    setSaved(false);
  }

  async function save() {
    setWorking(true);
    setError(null);
    const response = await fetch("/api/admin/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hours: draft }),
    });
    const data = (await response.json()) as { ok: boolean; error?: string };
    setWorking(false);
    if (!data.ok) {
      setError(data.error ?? "No se pudo guardar el horario.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  async function restore() {
    setWorking(true);
    setError(null);
    await fetch("/api/admin/schedule", { method: "DELETE" });
    setWorking(false);
    router.refresh();
  }

  const totalHours = WEEK_ORDER.reduce(
    (sum, day) =>
      sum +
      (draft[day] ?? []).reduce((daySum, r) => {
        const minutes = toMinutesSafe(r.end) - toMinutesSafe(r.start);
        return daySum + (minutes > 0 ? minutes : 0);
      }, 0),
    0,
  );

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[19px]">Mi horario</h2>
          <p className="mt-1 max-w-lg text-[13.5px] leading-relaxed text-muted">
            Las horas en las que aceptas citas. Se aplica en cuanto guardas, y la web deja de
            ofrecer lo que quites. Para cerrar un día suelto —un médico, un viaje— usa{" "}
            <span className="font-medium text-ink">Bloquear horas</span>: eso no toca tu horario
            de siempre.
          </p>
        </div>
        <p className="text-[13px] text-muted">
          {Math.round((totalHours / 60) * 10) / 10} h a la semana
        </p>
      </div>

      <div className="mt-5 divide-y divide-line border-y border-line">
        {WEEK_ORDER.map((day) => {
          const ranges = draft[day] ?? [];
          return (
            <div key={day} className="grid gap-3 py-4 sm:grid-cols-[130px_1fr]">
              <div>
                <p className="text-[14px] font-semibold text-ink">{WEEKDAY_NAMES[day]}</p>
                {ranges.length === 0 && <p className="text-[12.5px] text-muted">Cerrado</p>}
              </div>

              <div className="space-y-2">
                {ranges.map((range, index) => (
                  <div key={index} className="flex flex-wrap items-center gap-2">
                    <input
                      type="time"
                      className="field w-[110px] py-1.5"
                      value={range.start}
                      onChange={(e) => editRange(day, index, "start", e.target.value)}
                    />
                    <span className="text-muted">–</span>
                    <input
                      type="time"
                      className="field w-[110px] py-1.5"
                      value={range.end}
                      onChange={(e) => editRange(day, index, "end", e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => removeRange(day, index)}
                    >
                      Quitar
                    </button>
                  </div>
                ))}

                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-ghost btn-sm" onClick={() => addRange(day)}>
                    {ranges.length === 0 ? "Abrir este día" : "Añadir otra franja"}
                  </button>
                  {ranges.length > 0 && (
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => copyToWeekdays(day)}
                    >
                      Copiar a lunes–viernes
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {error && <p className="mt-4 text-[13.5px] text-red-700">{error}</p>}
      {saved && !error && <p className="mt-4 text-[13.5px] text-green-700">Horario guardado.</p>}

      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" className="btn" disabled={working} onClick={save}>
          {working ? "Guardando…" : "Guardar horario"}
        </button>
        {isCustom && (
          <button type="button" className="btn-ghost" disabled={working} onClick={restore}>
            Volver al horario original
          </button>
        )}
      </div>
    </div>
  );
}

/** "HH:MM" a minutos. Devuelve 0 si el campo está a medio escribir. */
function toMinutesSafe(value: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

function BlocksTab({ blocks, today }: { blocks: BlockRow[]; today: string }) {
  const router = useRouter();
  const [form, setForm] = useState({
    date: addDays(today, 1),
    start: "10:00",
    end: "14:00",
    reason: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [noShowError, setNoShowError] = useState<string | null>(null);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError(null);
    const response = await fetch("/api/admin/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = (await response.json()) as { ok: boolean; error?: string };
    setWorking(false);
    if (!data.ok) {
      setError(data.error ?? "No se pudo guardar el bloqueo.");
      return;
    }
    setForm({ ...form, reason: "" });
    router.refresh();
  }

  async function remove(id: number) {
    await fetch(`/api/admin/blocks?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={add} className="card p-5">
        <h2 className="text-[19px]">Bloquear un rato</h2>
        <p className="mt-1 text-[13.5px] leading-relaxed text-muted">
          Para el médico, un recado o simplemente descansar. Esas horas dejan de ofrecerse en la web
          al instante.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="block-date">
              Día
            </label>
            <input
              id="block-date"
              type="date"
              className="field"
              min={today}
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="block-start">
              Desde
            </label>
            <input
              id="block-start"
              type="time"
              className="field"
              value={form.start}
              onChange={(e) => setForm({ ...form, start: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="block-end">
              Hasta
            </label>
            <input
              id="block-end"
              type="time"
              className="field"
              value={form.end}
              onChange={(e) => setForm({ ...form, end: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="block-reason">
              Motivo <span className="font-normal text-muted">(solo lo ves tú)</span>
            </label>
            <input
              id="block-reason"
              className="field"
              placeholder="Médico, formación, descanso…"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-[13px] text-red-700">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary mt-4" disabled={working}>
          {working ? "Guardando…" : "Bloquear"}
        </button>
      </form>

      <div>
        <h2 className="text-[19px]">Bloqueos activos</h2>
        {blocks.length === 0 ? (
          <p className="mt-3 border border-line bg-surface px-5 py-8 text-center text-[14px] text-muted">
            No tienes ningún rato bloqueado.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {blocks.map((block) => (
              <li key={block.id} className="card flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-[14px] font-medium text-ink">
                    {capitalize(formatDateLong(block.date))}
                  </p>
                  <p className="text-[13px] text-muted">
                    {block.start_time}–{block.end_time}
                    {block.reason && ` · ${block.reason}`}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => remove(block.id)}
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const KIND_LABELS: Record<string, string> = {
  client_confirmation: "Confirmación a la clienta",
  owner_notification: "Aviso a ti",
  client_reminder: "Recordatorio del día antes",
  cancellation_client: "Cancelación · clienta",
  cancellation_owner: "Cancelación · tú",
  pending_payment: "Señal pendiente",
};

function EmailsTab({
  emails,
  mailMode,
}: {
  emails: EmailSummary[];
  mailMode: "real" | "simulado";
}) {
  const [openId, setOpenId] = useState<number | null>(emails[0]?.id ?? null);
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // El HTML se pide al abrir cada email y se pinta con srcdoc, para no cargar
  // en la página todos los correos a la vez.
  useEffect(() => {
    if (openId === null) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/emails/${openId}`)
      .then((response) => (response.ok ? response.text() : Promise.reject(response.status)))
      .then((text) => {
        if (!cancelled) setHtml(text);
      })
      .catch(() => {
        if (!cancelled) setHtml(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [openId]);

  if (emails.length === 0) {
    return (
      <p className="border border-line bg-surface px-5 py-10 text-center text-[14px] text-muted">
        Todavía no se ha enviado ningún email. Haz una reserva de prueba y aparecerá aquí.
      </p>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_1fr]">
      <ul className="space-y-2">
        {emails.map((email) => (
          <li key={email.id}>
            <button
              type="button"
              onClick={() => setOpenId(email.id)}
              className={`w-full border p-3 text-left transition-colors ${
                openId === email.id
                  ? "border-primary bg-primary/[0.04]"
                  : "border-line bg-surface hover:border-primary/60"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold text-primary-dark">
                  {KIND_LABELS[email.kind] ?? email.kind}
                </span>
                <span className="shrink-0 text-[11px] text-muted">
                  {new Date(email.created_at).toLocaleString(siteConfig.business.locale, {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </span>
              <span className="mt-1 block truncate text-[13.5px] font-medium text-ink">
                {email.subject}
              </span>
              <span className="mt-0.5 block truncate text-[12px] text-muted">
                para {email.to_addr}
              </span>
              {email.error && (
                <span className="mt-1 block text-[11.5px] text-red-700">Error: {email.error}</span>
              )}
              {email.transport === "simulado" && (
                <span className="mt-1 inline-block bg-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  no enviado · simulado
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      <div className="card overflow-hidden">
        {mailMode === "simulado" && (
          <p className="border-b border-line bg-bg px-4 py-2.5 text-[12.5px] leading-relaxed text-muted">
            Vista previa del email tal y como lo recibiría la clienta. En modo simulado no se envía a
            internet; también queda como archivo en <code className="font-mono">data/outbox/</code>.
          </p>
        )}
        {loading && !html && (
          <p className="px-4 py-10 text-center text-[14px] text-muted">Cargando el email…</p>
        )}
        {html && (
          <iframe
            key={openId}
            srcDoc={html}
            title="Vista previa del email"
            // sandbox vacío: el contenido guardado se muestra pero no ejecuta nada.
            sandbox=""
            className="h-[700px] w-full border-0 bg-white"
          />
        )}
        {!loading && !html && (
          <p className="px-4 py-10 text-center text-[14px] text-muted">
            No se pudo cargar la vista previa de este email.
          </p>
        )}
      </div>
    </div>
  );
}
