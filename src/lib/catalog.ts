import siteConfig, { type AddOn, type Service, type ServiceCategory } from "@config";

export type ResolvedService = Service & { categoryId: string; categoryName: string };

/** Todos los servicios de todas las categorías, con su categoría resuelta. */
export function allServices(): ResolvedService[] {
  return siteConfig.categories.flatMap((c: ServiceCategory) =>
    c.services.map((s) => ({ ...s, categoryId: c.id, categoryName: c.name })),
  );
}

export function findService(id: string): ResolvedService | undefined {
  return allServices().find((s) => s.id === id);
}

export function findCategory(id: string): ServiceCategory | undefined {
  return siteConfig.categories.find((c) => c.id === id);
}

/**
 * Extras disponibles para una selección de servicios: los de las categorías a
 * las que pertenecen, sin repetir.
 *
 * Quien se hace manos y pies ve los extras de las dos, y son extras distintos
 * a propósito: las piedras de las manos y las de los pies se cuentan por
 * separado porque son dos cantidades distintas.
 */
export function addOnsForServices(serviceIds: string[]): AddOn[] {
  return gruposDeExtras(serviceIds).flatMap((g) => g.addOns);
}

/**
 * Los mismos extras, separados por categoría.
 *
 * Hace falta porque los nombres se repiten entre categorías: en una cita de
 * manos y pies hay dos "Francesa" y dos "Piedras o cristales", y una lista
 * corrida no deja saber cuál es cuál. Con un servicio solo, el título sobra.
 */
export function gruposDeExtras(
  serviceIds: string[],
): { categoryId: string; categoryName: string; addOns: AddOn[] }[] {
  const categorias = new Set<string>();
  for (const id of serviceIds) {
    const service = findService(id);
    if (service) categorias.add(service.categoryId);
  }

  return siteConfig.categories
    .filter((c) => categorias.has(c.id) && c.addOns.length > 0)
    .map((c) => ({ categoryId: c.id, categoryName: c.name, addOns: c.addOns }));
}

/** Cuántas unidades admite un extra: 1 si no se cobra por pieza. */
export function maxUnidades(addOn: AddOn): number {
  return addOn.perUnit ? addOn.perUnit.max : 1;
}

/** Un extra elegido, con cuántas unidades. */
export type AddOnPick = { id: string; units: number };

export type QuotedAddOn = AddOn & {
  units: number;
  /** Lo que suma este extra en total: precio por unidad × unidades. */
  lineCents: number;
  /** Minutos que suma en total. */
  lineMinutes: number;
};

export function resolveAddOns(serviceIds: string[], picks: AddOnPick[]): QuotedAddOn[] {
  const disponibles = addOnsForServices(serviceIds);

  return picks
    .map((pick) => {
      const addOn = disponibles.find((a) => a.id === pick.id);
      if (!addOn) return null;

      /*
       * Las unidades se recortan aquí, en el servidor: lo que llega del
       * navegador dice QUÉ se ha elegido, nunca cuánto vale ni cuántas caben.
       */
      const units = Math.min(Math.max(Math.round(pick.units) || 1, 1), maxUnidades(addOn));
      return {
        ...addOn,
        units,
        lineCents: Math.round(addOn.price * 100) * units,
        lineMinutes: addOn.durationMin * units,
      };
    })
    .filter((a): a is QuotedAddOn => a !== null);
}

export type Quote = {
  /** Los servicios de la cita, en el orden de la carta. */
  services: ResolvedService[];
  addOns: QuotedAddOn[];
  /** Precio en céntimos, para no arrastrar errores de coma flotante. */
  totalCents: number;
  /** true si algún componente es "desde": el precio final puede subir. */
  isFrom: boolean;
  /** Duración total incluyendo extras (sin el buffer de limpieza). */
  durationMin: number;
  depositCents: number;
};

/** "Semipermanente + Pedicura básica" */
export function nombreDe(services: { name: string }[]): string {
  return services.map((s) => s.name).join(" + ");
}

/**
 * Calcula precio, duración y señal de una selección.
 *
 * Acepta varios servicios porque una cita real son varios: retirar el trabajo
 * de otro centro y poner acrílicas, o hacerse manos y pies de una sentada. Se
 * suman los precios y, sobre todo, las duraciones: si la cita ocupara solo lo
 * que dura el primer servicio, la agenda daría por libre un hueco en el que
 * ella sigue trabajando.
 *
 * Es la única fuente de verdad: el servidor la recalcula siempre, nunca
 * confía en los importes que llegan del navegador.
 */
export function quote(serviceIds: string[], picks: AddOnPick[] = []): Quote | null {
  /* Sin repetidos y en el orden de la carta, no en el que fue pulsando. */
  const services = allServices().filter((s) => serviceIds.includes(s.id));
  if (services.length === 0) return null;

  const addOns = resolveAddOns(serviceIds, picks);

  const serviciosCents = services.reduce((sum, s) => sum + Math.round(s.price * 100), 0);
  const totalCents = serviciosCents + addOns.reduce((sum, a) => sum + a.lineCents, 0);

  const durationMin =
    services.reduce((sum, s) => sum + s.durationMin, 0) +
    addOns.reduce((sum, a) => sum + a.lineMinutes, 0);

  return {
    services,
    addOns,
    totalCents,
    isFrom: services.some((s) => Boolean(s.from)),
    durationMin,
    depositCents: depositFor(totalCents),
  };
}

/** Señal en céntimos según la configuración. Nunca supera el total. */
export function depositFor(totalCents: number): number {
  const { deposit } = siteConfig;
  if (!deposit.enabled) return 0;
  const raw =
    deposit.mode === "percent"
      ? Math.round((totalCents * deposit.amount) / 100)
      : Math.round(deposit.amount * 100);
  return Math.min(raw, totalCents);
}

/* -------------------------------------------------------------------------- */
/*  Ida y vuelta por la URL                                                   */
/* -------------------------------------------------------------------------- */

/*
 * Los extras viajan como "piedras:10,francesa:1" en la query de disponibilidad.
 * Un extra sin ":" vale 1 unidad, que es como se escribían antes: así los
 * enlaces antiguos siguen funcionando.
 */

export function picksToParam(picks: AddOnPick[]): string {
  return picks.map((p) => (p.units > 1 ? `${p.id}:${p.units}` : p.id)).join(",");
}

export function picksFromParam(raw: string): AddOnPick[] {
  return raw
    .split(",")
    .filter(Boolean)
    .map((trozo) => {
      const [id, units] = trozo.split(":");
      return { id, units: Number(units) || 1 };
    });
}
