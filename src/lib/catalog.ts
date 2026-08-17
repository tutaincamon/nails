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

/** Extras disponibles para un servicio (los de su categoría). */
export function addOnsForService(serviceId: string): AddOn[] {
  const service = findService(serviceId);
  if (!service) return [];
  return findCategory(service.categoryId)?.addOns ?? [];
}

export function resolveAddOns(serviceId: string, addOnIds: string[]): AddOn[] {
  const available = addOnsForService(serviceId);
  return addOnIds
    .map((id) => available.find((a) => a.id === id))
    .filter((a): a is AddOn => Boolean(a));
}

export type Quote = {
  service: ResolvedService;
  addOns: AddOn[];
  /** Precio en céntimos, para no arrastrar errores de coma flotante. */
  totalCents: number;
  /** true si algún componente es "desde": el precio final puede subir. */
  isFrom: boolean;
  /** Duración total incluyendo extras (sin el buffer de limpieza). */
  durationMin: number;
  depositCents: number;
};

/**
 * Calcula precio, duración y señal de una selección.
 * Es la única fuente de verdad: el servidor la recalcula siempre, nunca
 * confía en los importes que llegan del navegador.
 */
export function quote(serviceId: string, addOnIds: string[] = []): Quote | null {
  const service = findService(serviceId);
  if (!service) return null;

  const addOns = resolveAddOns(serviceId, addOnIds);
  const priceEuros = service.price + addOns.reduce((sum, a) => sum + a.price, 0);
  const totalCents = Math.round(priceEuros * 100);
  const durationMin = service.durationMin + addOns.reduce((sum, a) => sum + a.durationMin, 0);

  return {
    service,
    addOns,
    totalCents,
    isFrom: Boolean(service.from),
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
