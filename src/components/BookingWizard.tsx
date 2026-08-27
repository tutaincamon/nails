"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import siteConfig from "@config";
import { addOnsForService, quote } from "@/lib/catalog";
import { VerificarEmail, type DatosRecuperados } from "@/components/VerificarEmail";
import { formatCents } from "@/lib/money";
import { addDays, formatDateLong, formatDateShort, formatDuration, toMinutes } from "@/lib/time";

type Slot = { start: string; end: string };
type DayAvailability = { date: string; closed: boolean; closedReason?: string; slots: Slot[] };

type Step = 0 | 1 | 2 | 3;

const STEPS = ["Servicio", "Día y hora", "Tus datos", "Confirmar"];
const { deposit, booking: bookingRules, business } = siteConfig;

export function BookingWizard() {
  const router = useRouter();
  const params = useSearchParams();

  const [step, setStep] = useState<Step>(0);
  const [categoryId, setCategoryId] = useState(siteConfig.categories[0].id);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [addOnIds, setAddOnIds] = useState<string[]>([]);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [payment, setPayment] = useState<"deposit" | "on_site">(
    deposit.enabled ? "deposit" : "on_site",
  );

  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", notes: "" });
  /*
   * Pase firmado que acredita que el email quedó verificado con el código.
   * Mientras sea null, el paso de datos enseña la pantalla de verificación.
   */
  const [pase, setPase] = useState<string | null>(null);
  /* true = ya había reservado antes, así que sus datos vienen rellenos. */
  const [recordada, setRecordada] = useState(false);

  function alVerificar(email: string, nuevoPase: string, datos: DatosRecuperados | null) {
    setPase(nuevoPase);
    setForm((actual) => ({ ...actual, email, ...(datos ?? {}) }));
    setRecordada(datos !== null);
  }

  const [accepted, setAccepted] = useState(false);

  const [weekStart, setWeekStart] = useState<string>(() => todayISO());
  const [days, setDays] = useState<DayAvailability[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<string | null>(null);

  const topRef = useRef<HTMLDivElement>(null);

  /* --- Servicio preseleccionado desde la carta de la portada --------------- */
  useEffect(() => {
    const requested = params.get("service");
    if (!requested) return;
    const category = siteConfig.categories.find((c) =>
      c.services.some((s) => s.id === requested),
    );
    if (!category) return;
    setCategoryId(category.id);
    setServiceId(requested);
    setStep(1);
  }, [params]);

  const current = useMemo(
    () => (serviceId ? quote(serviceId, addOnIds) : null),
    [serviceId, addOnIds],
  );
  const category = siteConfig.categories.find((c) => c.id === categoryId)!;
  const availableAddOns = serviceId ? addOnsForService(serviceId) : [];

  /* --- Carga de huecos ---------------------------------------------------- */
  const loadWeek = useCallback(async (from: string, service: string, addons: string[]) => {
    setLoadingSlots(true);
    try {
      const query = new URLSearchParams({ service, from, days: "7" });
      if (addons.length) query.set("addons", addons.join(","));
      const response = await fetch(`/api/availability?${query}`, { cache: "no-store" });
      if (!response.ok) throw new Error("No se pudo cargar la agenda.");
      const data = (await response.json()) as { days: DayAvailability[] };
      setDays(data.days);
    } catch {
      setError("No se pudo cargar la agenda. Revisa tu conexión e inténtalo otra vez.");
      setDays([]);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  // Al elegir servicio, cambiar los extras o pasar de semana, se piden los huecos.
  useEffect(() => {
    if (!serviceId) return;
    void loadWeek(weekStart, serviceId, addOnIds);
  }, [serviceId, addOnIds, weekStart, loadWeek]);

  // La hora elegida deja de ser válida si cambia el servicio o los extras.
  useEffect(() => {
    setTime(null);
  }, [serviceId, addOnIds]);

  const goTo = (next: Step) => {
    setError(null);
    setErrorField(null);
    setStep(next);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* --- Envío -------------------------------------------------------------- */
  async function submit() {
    if (!serviceId || !date || !time) return;
    setSubmitting(true);
    setError(null);
    setErrorField(null);

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: serviceId,
          addons: addOnIds,
          date,
          time,
          name: form.name,
          email: form.email,
          phone: form.phone,
          address: form.address,
          notes: form.notes,
          payment,
          pase,
        }),
      });

      const data = (await response.json()) as {
        ok: boolean;
        error?: string;
        field?: string;
        next?: string;
      };

      if (!response.ok || !data.ok) {
        setError(data.error ?? "No se pudo completar la reserva.");
        setErrorField(data.field ?? null);
        // Si el hueco se ocupó mientras rellenaba el formulario, se vuelve al paso 1.
        if (response.status === 409) {
          setTime(null);
          void loadWeek(weekStart, serviceId, addOnIds);
          goTo(1);
        }
        return;
      }

      router.push(data.next!);
    } catch {
      setError("Hubo un problema de conexión. Tu reserva no se ha guardado; inténtalo otra vez.");
    } finally {
      setSubmitting(false);
    }
  }

  const canContinue: Record<Step, boolean> = {
    0: Boolean(serviceId),
    1: Boolean(date && time),
    2: Boolean(pase) && form.name.trim().length >= 2 && form.phone.trim().length >= 9,
    3: accepted && !submitting,
  };

  return (
    <div ref={topRef} className="section grid scroll-mt-24 gap-8 py-10 lg:grid-cols-[1fr_340px] lg:gap-12 lg:py-14">
      <div>
        <Progress step={step} onJump={(s) => s < step && goTo(s)} />

        {error && (
          <p
            role="alert"
            className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-800"
          >
            {error}
          </p>
        )}

        {/* ------------------------------------------------- PASO 0: SERVICIO */}
        {step === 0 && (
          <div className="animate-rise mt-8">
            <h2 className="text-[26px]">¿Qué te apetece hacerte?</h2>
            <p className="mt-1.5 text-[14px] text-muted">
              Cada servicio tiene su propia duración, y la agenda reserva ese tiempo entero para ti.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {siteConfig.categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  className={`btn-sm border ${
                    c.id === categoryId
                      ? "border-primary bg-primary text-white"
                      : "border-line bg-surface text-muted hover:border-primary hover:text-primary"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <p className="mt-4 text-[13px] text-muted">{category.subtitle}</p>

            <ul className="mt-4 space-y-2.5">
              {category.services.map((service) => {
                const selected = serviceId === service.id;
                return (
                  <li key={service.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setServiceId(service.id);
                        setAddOnIds([]);
                      }}
                      aria-pressed={selected}
                      className={`flex w-full items-start gap-4 border p-4 text-left transition-all ${
                        selected
                          ? "border-primary bg-primary/[0.04] shadow-sm"
                          : "border-line bg-surface hover:border-primary/60"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                          selected ? "border-primary" : "border-line"
                        }`}
                      >
                        {selected && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-[18px] leading-snug text-ink">
                          {service.name}
                        </span>
                        {service.description && (
                          <span className="mt-0.5 block text-[13.5px] leading-relaxed text-muted">
                            {service.description}
                          </span>
                        )}
                        <span className="mt-1 block text-[12.5px] text-muted/80">
                          {formatDuration(service.durationMin)}
                        </span>
                      </span>

                      <span className="shrink-0 text-right">
                        <span className="block whitespace-nowrap text-[16px] font-semibold text-ink">
                          {formatCents(Math.round(service.price * 100))}
                        </span>
                        {service.from && (
                          <span className="block text-[11px] text-muted">desde</span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {serviceId && availableAddOns.length > 0 && (
              <fieldset className="mt-6 border border-line bg-surface p-4">
                <legend className="eyebrow px-1">¿Necesitas algún extra?</legend>
                <ul className="mt-2 space-y-2">
                  {availableAddOns.map((addOn) => (
                    <li key={addOn.id}>
                      <label className="flex cursor-pointer items-center gap-3 text-[14px]">
                        <input
                          type="checkbox"
                          checked={addOnIds.includes(addOn.id)}
                          onChange={(e) =>
                            setAddOnIds((prev) =>
                              e.target.checked
                                ? [...prev, addOn.id]
                                : prev.filter((id) => id !== addOn.id),
                            )
                          }
                          className="h-4 w-4 accent-[var(--c-primary)]"
                        />
                        <span className="flex-1 text-ink">{addOn.name}</span>
                        <span className="font-semibold text-ink">
                          + {formatCents(Math.round(addOn.price * 100))}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            )}
          </div>
        )}

        {/* ---------------------------------------------- PASO 1: DÍA Y HORA */}
        {step === 1 && (
          <div className="animate-rise mt-8">
            <h2 className="text-[26px]">¿Cuándo te viene bien?</h2>
            <p className="mt-1.5 text-[14px] text-muted">
              Solo se muestran las horas en las que caben los{" "}
              {current ? formatDuration(current.durationMin) : ""} que necesita tu servicio.
            </p>

            <WeekPicker
              days={days}
              weekStart={weekStart}
              selectedDate={date}
              loading={loadingSlots}
              onSelectDate={(d) => {
                setDate(d);
                setTime(null);
              }}
              onShift={(delta) => {
                const next = addDays(weekStart, delta);
                const today = todayISO();
                // Al volver atrás nunca se muestran días ya pasados.
                setWeekStart(next < today ? today : next);
              }}
            />

            {date && <SlotPicker day={days.find((d) => d.date === date)} value={time} onSelect={setTime} />}

            {!date && !loadingSlots && (
              <p className="mt-6 border border-line bg-surface px-4 py-8 text-center text-[14px] text-muted">
                Elige un día arriba para ver las horas libres.
              </p>
            )}
          </div>
        )}

        {/* -------------------------------------------------- PASO 2: DATOS */}
        {/*
          Sin pase, este paso es solo la verificación del email. Es la puerta:
          hasta que no demuestre que ese buzón es suyo no se le pide nada más,
          y así tampoco se sabe desde fuera si esa dirección es clienta o no.
        */}
        {step === 2 && !pase && <VerificarEmail onVerificado={alVerificar} />}

        {step === 2 && pase && (
          <div className="animate-rise mt-8">
            <h2 className="text-[26px]">
              {recordada ? "¿Sigue todo igual?" : "¿Cómo te localizo?"}
            </h2>
            <p className="mt-1.5 text-[14px] text-muted">
              {recordada
                ? siteConfig.venue.needsClientAddress
                  ? "Ya te conozco. Revisa sobre todo la dirección y, si todo sigue igual, sigue adelante."
                  : "Ya te conozco. Revisa que siga todo igual y sigue adelante."
                : "Es tu primera vez, así que necesito un par de datos más. Solo usaré el teléfono si surge algún cambio."}
            </p>

            <p className="mt-3 border border-line bg-surface px-4 py-2.5 text-[12.5px] leading-relaxed text-muted">
              Email verificado: <strong className="text-ink">{form.email}</strong>
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="name">
                  Nombre y apellido
                </label>
                <input
                  id="name"
                  className={`field ${errorField === "name" ? "field-error" : ""}`}
                  value={form.name}
                  autoComplete="name"
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Lucía Fernández"
                />
              </div>

              {/*
                El email ya no se pide aquí: viene verificado del paso anterior
                y se enseña arriba. Dejar el campo editable permitiría cambiarlo
                por otro sin verificar, que es justo lo que evita el código.
              */}

              <div className="sm:col-span-2">
                <label className="label" htmlFor="phone">
                  Teléfono
                </label>
                <input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  className={`field ${errorField === "phone" ? "field-error" : ""}`}
                  value={form.phone}
                  autoComplete="tel"
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="600 00 00 00"
                />
              </div>

              {/*
                Solo cuando es la profesional quien se desplaza. En un estudio
                la dirección de la clienta no pinta nada y no se le pide.
              */}
              {siteConfig.venue.needsClientAddress && (
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="address">
                    {siteConfig.venue.addressLabel}
                  </label>
                  <textarea
                    id="address"
                    rows={2}
                    className={`field resize-y ${errorField === "address" ? "field-error" : ""}`}
                    value={form.address}
                    autoComplete="street-address"
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Calle Mayor 12, 3º B, Getafe"
                  />
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
                    {siteConfig.venue.addressHint}
                  </p>
                </div>
              )}

              <div className="sm:col-span-2">
                <label className="label" htmlFor="notes">
                  ¿Algo que deba saber? <span className="font-normal text-muted">(opcional)</span>
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  className="field resize-y"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Llevo acrílicas de otro sitio, alergias, la idea de diseño que tengo en mente…"
                />
              </div>

            </div>
          </div>
        )}

        {/* ----------------------------------------------- PASO 3: CONFIRMAR */}
        {step === 3 && current && date && time && (
          <div className="animate-rise mt-8">
            <h2 className="text-[26px]">Repasa y confirma</h2>

            <dl className="mt-6 divide-y divide-line border border-line bg-surface px-5">
              <Row label="Servicio" value={current.service.name} />
              {current.addOns.length > 0 && (
                <Row label="Extras" value={current.addOns.map((a) => a.name).join(", ")} />
              )}
              <Row label="Día" value={formatDateLong(date)} />
              <Row
                label="Hora"
                value={`${time} – ${addMinutesLabel(time, current.durationMin)} (${formatDuration(current.durationMin)})`}
              />
              <Row label="A nombre de" value={form.name} />
              <Row label="Email" value={form.email} />
              <Row label="Teléfono" value={form.phone} />
              {form.address.trim() && (
                <Row label={siteConfig.venue.addressLabel} value={form.address.trim()} />
              )}
              {form.notes.trim() && <Row label="Nota" value={form.notes.trim()} />}
            </dl>

            {deposit.enabled && current.depositCents > 0 && (
              <fieldset className="mt-6">
                <legend className="label">¿Cómo prefieres pagar?</legend>
                <div className="mt-1 space-y-2.5">
                  <PaymentOption
                    checked={payment === "deposit"}
                    onChange={() => setPayment("deposit")}
                    title={`Señal de ${formatCents(current.depositCents)} ahora`}
                    description={`Confirmas el hueco al instante. Se descuenta del precio final: el resto (${formatCents(current.totalCents - current.depositCents)}${current.isFrom ? " o más según el diseño" : ""}) se paga ${siteConfig.venue.payWhere}.`}
                  />
                  {deposit.allowPayOnSite && (
                    <PaymentOption
                      checked={payment === "on_site"}
                      onChange={() => setPayment("on_site")}
                      title={`Pagar todo ${siteConfig.venue.payWhere}`}
                      description="La cita queda reservada igual. Te pido que avises si no puedes venir, para poder dar el hueco."
                    />
                  )}
                </div>
                <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted">{deposit.note}</p>
              </fieldset>
            )}

            <label className="mt-6 flex cursor-pointer items-start gap-3 text-[13.5px] leading-relaxed text-muted">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--c-primary)]"
              />
              <span>
                {/*
                  Esta casilla es lo que legitima dos cosas distintas: tratar
                  sus datos y, si procede, cobrarle por no venir. Tiene que
                  nombrar y enlazar las dos, y quedar sin marcar por defecto:
                  un consentimiento premarcado no es consentimiento.
                */}
                He leído y acepto la{" "}
                <a
                  href="/privacidad"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary underline underline-offset-2"
                >
                  política de privacidad
                </a>{" "}
                y las{" "}
                <a
                  href="/condiciones"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary underline underline-offset-2"
                >
                  condiciones de reserva
                </a>
                : puedo cancelar sin coste hasta {bookingRules.cancellationHours} h antes, y si
                llego con mucho retraso quizá haya que simplificar el diseño o mover la cita.
                {/*
                  Con la política de plantones encendida esto deja de ser un
                  formalismo: es lo que autoriza el cobro, así que se dice
                  entero y con el importe delante, no escondido en un enlace.
                */}
                {siteConfig.noShow.enabled && siteConfig.noShow.terms && (
                  <strong className="mt-2 block font-medium text-ink">
                    {siteConfig.noShow.terms}
                  </strong>
                )}
              </span>
            </label>
          </div>
        )}

        {/* ------------------------------------------------------ NAVEGACIÓN */}
        <div className="mt-9 flex items-center gap-3">
          {step > 0 && (
            <button type="button" className="btn-ghost" onClick={() => goTo((step - 1) as Step)}>
              Atrás
            </button>
          )}

          {step < 3 ? (
            <button
              type="button"
              className="btn-primary"
              disabled={!canContinue[step]}
              onClick={() => goTo((step + 1) as Step)}
            >
              Continuar
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              disabled={!canContinue[3]}
              onClick={submit}
            >
              {submitting
                ? "Reservando…"
                : payment === "deposit" && current && current.depositCents > 0
                  ? `Reservar y pagar ${formatCents(current.depositCents)}`
                  : "Confirmar reserva"}
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------ RESUMEN */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="card p-5">
          <p className="eyebrow">Tu cita</p>

          {!current ? (
            <p className="mt-3 text-[14px] leading-relaxed text-muted">
              Elige un servicio y aquí verás el resumen con el precio y la duración.
            </p>
          ) : (
            <>
              <p className="mt-2 font-display text-[19px] leading-snug text-ink">
                {current.service.name}
              </p>
              <p className="text-[13px] text-muted">{current.service.categoryName}</p>

              <ul className="mt-4 space-y-1.5 border-t border-line pt-4 text-[14px]">
                <li className="flex justify-between gap-3">
                  <span className="text-muted">Servicio</span>
                  <span className="text-ink">
                    {formatCents(Math.round(current.service.price * 100))}
                  </span>
                </li>
                {current.addOns.map((addOn) => (
                  <li key={addOn.id} className="flex justify-between gap-3">
                    <span className="text-muted">{addOn.name}</span>
                    <span className="text-ink">
                      + {formatCents(Math.round(addOn.price * 100))}
                    </span>
                  </li>
                ))}
                <li className="flex justify-between gap-3 border-t border-line pt-2.5 font-semibold">
                  <span className="text-ink">Total</span>
                  <span className="text-ink">
                    {current.isFrom && <span className="font-normal text-muted">desde </span>}
                    {formatCents(current.totalCents)}
                  </span>
                </li>
              </ul>

              <dl className="mt-4 space-y-1.5 border-t border-line pt-4 text-[13.5px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Duración</dt>
                  <dd className="text-ink">{formatDuration(current.durationMin)}</dd>
                </div>
                {date && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Día</dt>
                    <dd className="text-right text-ink">{formatDateLong(date)}</dd>
                  </div>
                )}
                {time && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Hora</dt>
                    <dd className="text-ink">{time}</dd>
                  </div>
                )}
              </dl>

              {deposit.enabled && current.depositCents > 0 && (
                <p className="mt-4 bg-bg px-3 py-2.5 text-[12.5px] leading-relaxed text-muted">
                  {payment === "deposit"
                    ? `Ahora pagas ${formatCents(current.depositCents)} de señal; el resto ${siteConfig.venue.payWhere}.`
                    : `Pagarás el importe completo ${siteConfig.venue.payWhere}.`}
                </p>
              )}

              {current.isFrom && (
                <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
                  El precio final depende del detalle del diseño. Te lo confirmo antes de empezar.
                </p>
              )}
            </>
          )}

          <p className="mt-5 border-t border-line pt-4 text-[12.5px] leading-relaxed text-muted">
            {business.whatsapp ? (
              <>
                ¿Dudas antes de reservar?{" "}
                <a
                  href={`https://wa.me/${business.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-primary hover:underline"
                >
                  Escríbeme por WhatsApp
                </a>
              </>
            ) : (
              "¿Alguna duda sobre el diseño? Cuéntamela en la nota del último paso y la vemos antes de la cita."
            )}
          </p>
        </div>
      </aside>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Piezas auxiliares                                                        */
/* -------------------------------------------------------------------------- */

function todayISO(): string {
  // El servidor decide qué días son válidos; esto solo sitúa el calendario.
  return new Date().toLocaleDateString("en-CA", { timeZone: business.timezone });
}

function addMinutesLabel(start: string, minutes: number): string {
  const total = toMinutes(start) + minutes;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function Progress({ step, onJump }: { step: Step; onJump: (step: Step) => void }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[13px]">
      {STEPS.map((label, index) => {
        const done = index < step;
        const active = index === step;
        return (
          <li key={label} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onJump(index as Step)}
              disabled={!done}
              className={`flex items-center gap-2 px-3 py-1.5 transition-colors ${
                active
                  ? "bg-primary text-white"
                  : done
                    ? "bg-surface text-ink hover:text-primary"
                    : "text-muted"
              }`}
            >
              <span
                className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold ${
                  active ? "bg-white/25" : done ? "bg-accent/30 text-primary-dark" : "bg-line"
                }`}
              >
                {done ? "✓" : index + 1}
              </span>
              {label}
            </button>
            {index < STEPS.length - 1 && <span className="text-line">·</span>}
          </li>
        );
      })}
    </ol>
  );
}

function WeekPicker({
  days,
  weekStart,
  selectedDate,
  loading,
  onSelectDate,
  onShift,
}: {
  days: DayAvailability[];
  weekStart: string;
  selectedDate: string | null;
  loading: boolean;
  onSelectDate: (date: string) => void;
  onShift: (delta: number) => void;
}) {
  const atStart = weekStart <= todayISO();

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between gap-4">
        <p className="text-[13px] font-semibold text-ink">
          {monthLabel(weekStart, addDays(weekStart, 6))}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onShift(-7)}
            disabled={atStart}
            aria-label="Semana anterior"
            className="btn-ghost btn-sm disabled:opacity-40"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => onShift(7)}
            aria-label="Semana siguiente"
            className="btn-ghost btn-sm"
          >
            →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {days.map((day) => {
          const label = formatDateShort(day.date);
          const free = day.slots.length;
          const selected = day.date === selectedDate;

          return (
            <button
              key={day.date}
              type="button"
              disabled={free === 0}
              onClick={() => onSelectDate(day.date)}
              aria-pressed={selected}
              // Los tres trozos de texto sueltos no forman una etiqueta legible
              // con lector de pantalla, así que se dice la fecha completa.
              aria-label={`${formatDateLong(day.date)}: ${
                free === 0 ? "sin huecos libres" : `${free} hueco${free === 1 ? "" : "s"} libre${free === 1 ? "" : "s"}`
              }`}
              className={`border px-1 py-2.5 text-center transition-all ${
                selected
                  ? "border-primary bg-primary text-white shadow-sm"
                  : free === 0
                    ? "cursor-not-allowed border-line bg-bg text-muted/45"
                    : "border-line bg-surface text-ink hover:border-primary"
              }`}
            >
              <span className="block text-[11px] uppercase tracking-wide opacity-75">
                {label.weekday}
              </span>
              <span className="block text-[19px] font-semibold leading-tight">{label.day}</span>
              <span className="block text-[10.5px] opacity-80">
                {free === 0 ? "—" : `${free} hueco${free === 1 ? "" : "s"}`}
              </span>
            </button>
          );
        })}

        {days.length === 0 &&
          Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-[74px] animate-pulse bg-line/50" />
          ))}
      </div>

      {loading && <p className="mt-3 text-[13px] text-muted">Cargando huecos…</p>}
    </div>
  );
}

function SlotPicker({
  day,
  value,
  onSelect,
}: {
  day: DayAvailability | undefined;
  value: string | null;
  onSelect: (time: string) => void;
}) {
  if (!day) return null;

  if (day.slots.length === 0) {
    return (
      <p className="mt-6 border border-line bg-surface px-4 py-6 text-center text-[14px] text-muted">
        Ese día no queda sitio para este servicio. Prueba con otro día.
      </p>
    );
  }

  const morning = day.slots.filter((s) => toMinutes(s.start) < 14 * 60);
  const afternoon = day.slots.filter((s) => toMinutes(s.start) >= 14 * 60);

  const group = (title: string, slots: Slot[]) =>
    slots.length > 0 && (
      <div key={title} className="mt-5">
        <p className="eyebrow">{title}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {slots.map((slot) => (
            <button
              key={slot.start}
              type="button"
              onClick={() => onSelect(slot.start)}
              aria-pressed={value === slot.start}
              aria-label={`Cita de ${slot.start} a ${slot.end}`}
              className={`border px-4 py-2 text-[14px] font-medium transition-all ${
                value === slot.start
                  ? "border-primary bg-primary text-white shadow-sm"
                  : "border-line bg-surface text-ink hover:border-primary hover:text-primary"
              }`}
            >
              {slot.start}
            </button>
          ))}
        </div>
      </div>
    );

  return (
    <div className="mt-6 border border-line bg-surface p-5">
      <p className="text-[14px] font-semibold text-ink">{formatDateLong(day.date)}</p>
      {group("Mañana", morning)}
      {group("Tarde", afternoon)}
      {value && (
        <p className="mt-5 border-t border-line pt-3 text-[13px] text-muted">
          Cita de {value} a{" "}
          {day.slots.find((s) => s.start === value)?.end ?? ""}. Es tu hueco entero: no habrá nadie
          más a la vez.
        </p>
      )}
    </div>
  );
}

function PaymentOption({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  description: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 border p-4 transition-all ${
        checked ? "border-primary bg-primary/[0.04]" : "border-line bg-surface hover:border-primary/60"
      }`}
    >
      <input
        type="radio"
        name="payment"
        checked={checked}
        onChange={onChange}
        className="mt-1 h-4 w-4 shrink-0 accent-[var(--c-primary)]"
      />
      <span>
        <span className="block text-[15px] font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-relaxed text-muted">{description}</span>
      </span>
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-6 gap-y-1 py-3">
      <dt className="text-[13.5px] text-muted">{label}</dt>
      <dd className="max-w-[60%] text-right text-[14px] font-medium text-ink">{value}</dd>
    </div>
  );
}

function monthLabel(from: string, to: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Intl.DateTimeFormat(business.locale, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(y, m - 1, d)));
  };
  const a = fmt(from);
  const b = fmt(to);
  const label = a === b ? a : `${a.split(" ")[0]} – ${b}`;
  return label.charAt(0).toUpperCase() + label.slice(1);
}
