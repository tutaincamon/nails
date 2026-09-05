"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import siteConfig, { type AddOn } from "@config";
import {
  addOnsForServices,
  gruposDeExtras,
  maxUnidades,
  picksToParam,
  quote,
  type AddOnPick,
} from "@/lib/catalog";
import {
  VerificarEmail,
  olvidarRecuerdoLocal,
  type DatosRecuperados,
} from "@/components/VerificarEmail";
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
  /*
   * Varios servicios en la misma cita. Una cita real suele ser más de uno:
   * retirar el trabajo de otro centro y poner acrílicas, o hacerse manos y
   * pies de una sentada sin tener que reservar dos veces.
   */
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [picks, setPicks] = useState<AddOnPick[]>([]);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [payment, setPayment] = useState<"deposit" | "on_site">(
    deposit.enabled ? "deposit" : "on_site",
  );

  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", zone: "", notes: "" });
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

  /** Desvincula este dispositivo y vuelve a la pantalla del email. */
  function olvidarDispositivo() {
    olvidarRecuerdoLocal();
    setPase(null);
    setRecordada(false);
    setForm({ name: "", email: "", phone: "", address: "", zone: "", notes: "" });
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
    setServiceIds([requested]);
    setStep(1);
  }, [params]);

  const current = useMemo(
    () => (serviceIds.length > 0 ? quote(serviceIds, picks) : null),
    [serviceIds, picks],
  );
  const category = siteConfig.categories.find((c) => c.id === categoryId)!;
  const grupos = gruposDeExtras(serviceIds);

  /*
   * Desplazamiento. No es un extra del servicio: depende de dónde viva la
   * clienta, así que se suma aparte y se enseña como una línea más para que el
   * total no aparezca inflado sin explicación.
   *
   * Esto es solo lo que ella VE. El importe que se cobra lo vuelve a calcular
   * el servidor a partir del identificador de la zona.
   */
  const zonas = siteConfig.venue.zones;
  const zonaElegida = zonas.find((z) => z.id === form.zone) ?? null;
  const zonaCents = zonaElegida ? Math.round(zonaElegida.price * 100) : 0;
  const totalConZona = (current?.totalCents ?? 0) + zonaCents;
  const precioAbierto = Boolean(current?.isFrom) || Boolean(zonaElegida?.from);

  /** Marca o desmarca un servicio sin tocar los demás. */
  function alternarServicio(id: string) {
    setServiceIds((previos) =>
      previos.includes(id) ? previos.filter((s) => s !== id) : [...previos, id],
    );
  }

  /*
   * Al quitar un servicio pueden quedar extras de una categoría que ya no está
   * elegida. Se limpian solos: cobrar "piedras de los pies" en una cita que ya
   * no lleva pedicura sería cobrar de más sin que se vea por qué.
   */
  useEffect(() => {
    const validos = new Set(addOnsForServices(serviceIds).map((a) => a.id));
    setPicks((previos) => {
      const limpios = previos.filter((p) => validos.has(p.id));
      return limpios.length === previos.length ? previos : limpios;
    });
  }, [serviceIds]);

  /** Cuántas unidades hay elegidas de un extra. 0 = no está elegido. */
  const unidadesDe = (id: string) => picks.find((p) => p.id === id)?.units ?? 0;

  function ponerUnidades(id: string, units: number) {
    setPicks((previos) => {
      if (units <= 0) return previos.filter((p) => p.id !== id);
      if (previos.some((p) => p.id === id)) {
        return previos.map((p) => (p.id === id ? { ...p, units } : p));
      }
      return [...previos, { id, units }];
    });
  }

  /* --- Carga de huecos ---------------------------------------------------- */
  const loadWeek = useCallback(async (from: string, servicios: string[], addons: AddOnPick[]) => {
    setLoadingSlots(true);
    try {
      const query = new URLSearchParams({ service: servicios.join(","), from, days: "7" });
      if (addons.length) query.set("addons", picksToParam(addons));
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

  // Al cambiar los servicios, los extras o la semana, se piden los huecos.
  useEffect(() => {
    if (serviceIds.length === 0) return;
    void loadWeek(weekStart, serviceIds, picks);
  }, [serviceIds, picks, weekStart, loadWeek]);

  /*
   * La hora elegida deja de valer en cuanto cambia la selección: si añade la
   * pedicura después de elegir hora, la cita pasa de 20 a 50 minutos y ese
   * hueco puede haber dejado de caber.
   */
  useEffect(() => {
    setTime(null);
  }, [serviceIds, picks]);

  const goTo = (next: Step) => {
    setError(null);
    setErrorField(null);
    setStep(next);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* --- Envío -------------------------------------------------------------- */
  async function submit() {
    if (serviceIds.length === 0 || !date || !time) return;
    setSubmitting(true);
    setError(null);
    setErrorField(null);

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          services: serviceIds,
          addons: picks,
          date,
          time,
          name: form.name,
          email: form.email,
          phone: form.phone,
          address: form.address,
          zone: form.zone,
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
          void loadWeek(weekStart, serviceIds, picks);
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
    0: serviceIds.length > 0,
    1: Boolean(date && time),
    /*
     * La zona bloquea el paso igual que el nombre o el teléfono. El servidor
     * la exige de todas formas, pero enterarse al pulsar "Confirmar", con todo
     * ya rellenado, es la peor forma de descubrir que falta un campo.
     */
    2:
      Boolean(pase) &&
      form.name.trim().length >= 2 &&
      form.phone.trim().length >= 9 &&
      (zonas.length === 0 || Boolean(zonaElegida)),
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
              Puedes elegir más de uno y hacértelo todo en la misma cita: manos y pies, o una
              retirada y un trabajo nuevo. Se suman los tiempos y la agenda te reserva el rato
              entero.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {siteConfig.categories.map((c) => {
                /* Cuántos servicios lleva elegidos de esta categoría. */
                const elegidos = c.services.filter((s) => serviceIds.includes(s.id)).length;
                return (
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
                    {/*
                      Sin esto, quien elige la manicura y se va a la pestaña de
                      pies deja de ver lo que llevaba elegido y cree que lo ha
                      perdido.
                    */}
                    {elegidos > 0 && <span className="ml-1.5 opacity-70">{elegidos}</span>}
                  </button>
                );
              })}
            </div>

            <p className="mt-4 text-[13px] text-muted">{category.subtitle}</p>

            <ul className="mt-4 space-y-2.5">
              {category.services.map((service) => {
                const selected = serviceIds.includes(service.id);
                return (
                  <li key={service.id}>
                    <button
                      type="button"
                      onClick={() => alternarServicio(service.id)}
                      aria-pressed={selected}
                      className={`flex w-full items-start gap-4 border p-4 text-left transition-all ${
                        selected
                          ? "border-primary bg-primary/[0.04] shadow-sm"
                          : "border-line bg-surface hover:border-primary/60"
                      }`}
                    >
                      {/*
                        Cuadrado y no redondo: ahora se puede marcar más de uno,
                        y un círculo promete justo lo contrario.
                      */}
                      <span
                        aria-hidden="true"
                        className={`mt-1 grid h-5 w-5 shrink-0 place-items-center border-2 ${
                          selected ? "border-primary bg-primary" : "border-line"
                        }`}
                      >
                        {selected && (
                          <svg
                            viewBox="0 0 16 16"
                            className="h-3.5 w-3.5 text-white"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M3 8.5 6.5 12 13 4.5" />
                          </svg>
                        )}
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

            {grupos.length > 0 && (
              <fieldset className="mt-6 border border-line bg-surface p-4">
                <legend className="eyebrow px-1">¿Necesitas algún extra?</legend>
                {grupos.map((grupo) => (
                  <div key={grupo.categoryId} className="mt-2">
                    {/*
                      El título solo cuando hay más de un grupo: en una cita de
                      manos y pies se repiten "Francesa" y "Piedras", y sin
                      saber de cuál es cada una no se puede elegir bien.
                    */}
                    {grupos.length > 1 && (
                      <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
                        {grupo.categoryName}
                      </p>
                    )}
                    <ul className="divide-y divide-line">
                      {grupo.addOns.map((addOn) => (
                        <ExtraFila
                          key={addOn.id}
                          addOn={addOn}
                          units={unidadesDe(addOn.id)}
                          onChange={(n) => ponerUnidades(addOn.id, n)}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
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
              Email verificado: <strong className="text-ink">{form.email}</strong>{" "}
              {/*
                Imprescindible en un móvil compartido: sin esta salida, quien
                lo coja después reservaría con el correo de la anterior y vería
                su nombre, su teléfono y su dirección.
              */}
              <button
                type="button"
                onClick={olvidarDispositivo}
                className="font-semibold text-primary underline underline-offset-2"
              >
                No soy yo
              </button>
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

              {/*
                Zona de desplazamiento. Obligatoria cuando hay zonas: no se
                puede deducir de la dirección escrita a mano, y sin ella no se
                sabe lo que cuesta llegar.
              */}
              {zonas.length > 0 && (
                <div className="sm:col-span-2">
                  <p className="label">{siteConfig.venue.zonesLabel}</p>

                  {siteConfig.venue.zonesImage && (
                    <a
                      href={siteConfig.venue.zonesImage}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block border border-line bg-surface p-1"
                    >
                      {/*
                        Sin next/image a propósito: es un mapa que se mira de
                        cerca, y aquí interesa que se pueda abrir a tamaño
                        completo más que ahorrar unos kilobytes.

                        Y sin loading="lazy": el mapa es lo que hace falta para
                        contestar la pregunta que tiene justo debajo, así que
                        llegar y encontrarse un hueco en blanco no sirve.
                      */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={siteConfig.venue.zonesImage}
                        alt="Mapa de las zonas de desplazamiento"
                        /* El original es vertical y a lo ancho se comía la pantalla. */
                        className="mx-auto max-h-[380px] w-auto max-w-full"
                      />
                    </a>
                  )}

                  <ul
                    className={`mt-2 divide-y divide-line border bg-surface ${
                      errorField === "zone" ? "border-red-400" : "border-line"
                    }`}
                  >
                    {zonas.map((zona) => {
                      const elegida = form.zone === zona.id;
                      return (
                        <li key={zona.id}>
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, zone: zona.id })}
                            aria-pressed={elegida}
                            className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
                              elegida ? "bg-primary/5" : "hover:bg-bg"
                            }`}
                          >
                            <span className="flex items-center gap-2.5">
                              <span
                                aria-hidden
                                className={`inline-block h-4 w-4 shrink-0 rounded-full border ${
                                  elegida ? "border-[5px] border-primary" : "border-line"
                                }`}
                              />
                              <span>
                                <span
                                  className={`block text-[14.5px] ${elegida ? "font-semibold text-ink" : "text-ink"}`}
                                >
                                  {zona.name}
                                </span>
                                {zona.note && (
                                  <span className="block text-[12.5px] text-muted">{zona.note}</span>
                                )}
                              </span>
                            </span>
                            <span className="shrink-0 whitespace-nowrap text-[14.5px] font-semibold text-ink">
                              {zona.from && (
                                <span className="font-normal text-muted">desde </span>
                              )}
                              + {formatCents(Math.round(zona.price * 100))}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>

                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
                    {siteConfig.venue.zonesHint}
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
              <Row
                label={current.services.length > 1 ? "Servicios" : "Servicio"}
                value={current.services.map((s) => s.name).join(" + ")}
              />
              {current.addOns.length > 0 && (
                <Row
                  label="Extras"
                  value={current.addOns
                    .map((a) => (a.units > 1 ? `${a.name} ×${a.units}` : a.name))
                    .join(", ")}
                />
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
              {zonaElegida && (
                <Row
                  label="Desplazamiento"
                  value={`${zonaElegida.name} · ${zonaElegida.from ? "desde " : "+ "}${formatCents(zonaCents)}`}
                />
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
                {current.services.map((s) => s.name).join(" + ")}
              </p>
              <p className="text-[13px] text-muted">
                {[...new Set(current.services.map((s) => s.categoryName))].join(" y ")}
              </p>

              {/*
                Una línea por servicio y por extra. Con varias cosas en la misma
                cita, un único importe no deja comprobar de dónde sale el total.
              */}
              <ul className="mt-4 space-y-1.5 border-t border-line pt-4 text-[14px]">
                {current.services.map((service) => (
                  <li key={service.id} className="flex justify-between gap-3">
                    <span className="text-muted">{service.name}</span>
                    <span className="whitespace-nowrap text-ink">
                      {formatCents(Math.round(service.price * 100))}
                    </span>
                  </li>
                ))}
                {current.addOns.map((addOn) => (
                  <li key={addOn.id} className="flex justify-between gap-3">
                    <span className="text-muted">
                      {addOn.name}
                      {addOn.units > 1 && ` ×${addOn.units}`}
                    </span>
                    <span className="whitespace-nowrap text-ink">
                      + {formatCents(addOn.lineCents)}
                    </span>
                  </li>
                ))}
                {zonaElegida && (
                  <li className="flex justify-between gap-3">
                    <span className="text-muted">Desplazamiento · {zonaElegida.name}</span>
                    <span className="whitespace-nowrap text-ink">
                      + {formatCents(zonaCents)}
                    </span>
                  </li>
                )}
                <li className="flex justify-between gap-3 border-t border-line pt-2.5 font-semibold">
                  <span className="text-ink">Total</span>
                  <span className="text-ink">
                    {precioAbierto && <span className="font-normal text-muted">desde </span>}
                    {formatCents(totalConZona)}
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

/*
 * Un extra de la lista.
 *
 * Hay dos clases y se comportan distinto porque se cobran distinto. La francesa
 * se pone o no se pone. Las piedras van a euro la uña, así que la pregunta no
 * es «¿quieres?» sino «¿en cuántas?»: se elige la cantidad y el precio se
 * multiplica delante de ella. Enseñar «+ 1 €» en una clienta que quiere las
 * diez uñas sería anunciarle un precio que no es el suyo.
 */
function ExtraFila({
  addOn,
  units,
  onChange,
}: {
  addOn: AddOn;
  units: number;
  onChange: (units: number) => void;
}) {
  const elegido = units > 0;
  const tope = maxUnidades(addOn);
  const unidadCents = Math.round(addOn.price * 100);

  if (!addOn.perUnit) {
    return (
      <li>
        <label className="flex cursor-pointer items-center gap-3 py-2.5 text-[14px]">
          <input
            type="checkbox"
            checked={elegido}
            onChange={(e) => onChange(e.target.checked ? 1 : 0)}
            className="h-4 w-4 accent-[var(--c-primary)]"
          />
          <span className="flex-1 text-ink">{addOn.name}</span>
          <span className="font-semibold text-ink">+ {formatCents(unidadCents)}</span>
        </label>
      </li>
    );
  }

  const { singular, plural } = addOn.perUnit;

  return (
    <li className="py-2.5">
      <div className="flex items-center gap-3 text-[14px]">
        <input
          id={`extra-${addOn.id}`}
          type="checkbox"
          checked={elegido}
          /* Al marcarlo se empieza por todas: es lo que pide casi todo el mundo. */
          onChange={(e) => onChange(e.target.checked ? tope : 0)}
          className="h-4 w-4 accent-[var(--c-primary)]"
        />
        <label htmlFor={`extra-${addOn.id}`} className="flex-1 cursor-pointer text-ink">
          {addOn.name}
          <span className="block text-[12.5px] text-muted">
            {formatCents(unidadCents)} por {singular}
          </span>
        </label>

        {elegido ? (
          <span className="font-semibold text-ink">+ {formatCents(unidadCents * units)}</span>
        ) : (
          <span className="text-[13px] text-muted">
            hasta {formatCents(unidadCents * tope)}
          </span>
        )}
      </div>

      {elegido && (
        <div className="mt-2 flex items-center gap-3 pl-7">
          <div className="flex items-center border border-line">
            <button
              type="button"
              className="px-3 py-1 text-[16px] leading-none text-muted transition-colors hover:text-ink disabled:opacity-40"
              disabled={units <= 1}
              onClick={() => onChange(units - 1)}
              aria-label={`Una ${singular} menos`}
            >
              −
            </button>
            <span
              className="min-w-[2.5rem] px-1 text-center text-[14px] font-semibold text-ink"
              aria-live="polite"
            >
              {units}
            </span>
            <button
              type="button"
              className="px-3 py-1 text-[16px] leading-none text-muted transition-colors hover:text-ink disabled:opacity-40"
              disabled={units >= tope}
              onClick={() => onChange(units + 1)}
              aria-label={`Una ${singular} más`}
            >
              +
            </button>
          </div>
          <span className="text-[13px] text-muted">
            {units === 1 ? singular : plural}
            {units >= tope && ` (todas)`}
          </span>
        </div>
      )}
    </li>
  );
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
