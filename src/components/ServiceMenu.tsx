"use client";

import { useState } from "react";
import Link from "next/link";
import siteConfig from "@config";
import { formatCents, formatPrice } from "@/lib/money";
import { formatDuration } from "@/lib/time";

/** Carta de servicios con pestañas por categoría. */
export function ServiceMenu() {
  const categories = siteConfig.categories;
  const [activeId, setActiveId] = useState(categories[0].id);
  const active = categories.find((c) => c.id === activeId) ?? categories[0];

  return (
    <div>
      <div
        role="tablist"
        aria-label="Categorías de servicios"
        className="flex flex-wrap gap-2 border-b border-line pb-4"
      >
        {categories.map((category) => {
          const selected = category.id === active.id;
          return (
            <button
              key={category.id}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`panel-${category.id}`}
              onClick={() => setActiveId(category.id)}
              className={`btn-sm border transition-colors ${
                selected
                  ? "border-primary bg-primary text-white"
                  : "border-line bg-surface text-muted hover:border-primary hover:text-primary"
              }`}
            >
              {category.name}
            </button>
          );
        })}
      </div>

      <div id={`panel-${active.id}`} role="tabpanel" className="animate-rise pt-6">
        <p className="mb-5 text-[14px] text-muted">{active.subtitle}</p>

        <ul className="divide-y divide-line">
          {active.services.map((service) => (
            <li key={service.id} className="group flex flex-wrap items-baseline gap-x-4 gap-y-1 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <h3 className="font-display text-[19px] leading-snug text-ink">{service.name}</h3>
                  {service.featured && (
                    <span className="bg-accent/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-dark">
                      Más pedido
                    </span>
                  )}
                </div>
                {service.description && (
                  <p className="mt-0.5 text-[14px] leading-relaxed text-muted">
                    {service.description}
                  </p>
                )}
                <p className="mt-1 text-[13px] text-muted/80">
                  {formatDuration(service.durationMin)} {siteConfig.venue.where}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-4">
                <span className="whitespace-nowrap text-[16px] font-semibold text-ink">
                  {formatPrice(Math.round(service.price * 100), service.from)}
                </span>
                <Link
                  href={`/reservar?service=${service.id}`}
                  className="btn-ghost btn-sm opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
                >
                  Reservar
                </Link>
              </div>
            </li>
          ))}
        </ul>

        {active.addOns.length > 0 && (
          <div className="mt-6 border border-line bg-bg p-4">
            <p className="eyebrow">Extras opcionales</p>
            <ul className="mt-2 space-y-1 text-[14px] text-muted">
              {active.addOns.map((addOn) => (
                <li key={addOn.id} className="flex justify-between gap-4">
                  <span>{addOn.name}</span>
                  {/*
                    Lo que se cobra por pieza se anuncia por pieza. Poner "+1 €"
                    a secas en las piedras promete un precio que luego no es.
                  */}
                  <span className="whitespace-nowrap font-semibold text-ink">
                    + {formatCents(Math.round(addOn.price * 100))}
                    {addOn.perUnit && (
                      <span className="font-normal text-muted"> / {addOn.perUnit.singular}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
