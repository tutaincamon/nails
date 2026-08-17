"use client";

import type { Stats } from "@/lib/stats";
import { formatCents } from "@/lib/money";

/*
 * Resumen del negocio. Todo se calcula en el servidor: aquí solo se pinta.
 *
 * El gráfico son barras con altura en píxeles calculada sobre el mes más alto.
 * No hace falta ninguna librería para doce barras, y así la página no carga
 * cientos de kilobytes de más para dibujar esto.
 */

const CHART_HEIGHT = 150;

/**
 * Variación porcentual entre dos meses, null si el anterior fue cero.
 *
 * Vive aquí y no en lib/stats porque este componente se ejecuta en el
 * navegador, y ese módulo consulta la base de datos: importarlo arrastraría
 * el cliente de SQLite al paquete que descarga la clienta.
 */
function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function StatsPanel({ stats }: { stats: Stats }) {
  if (stats.empty) {
    return (
      <div className="card px-6 py-14 text-center">
        <p className="font-display text-[22px] text-ink">Todavía no hay datos</p>
        <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-muted">
          En cuanto tengas la primera cita confirmada empezarán a aparecer aquí los ingresos, las
          clientas que repiten y los servicios que más te piden.
        </p>
      </div>
    );
  }

  const { thisMonth, lastMonth, months } = stats;
  const revenueChange = lastMonth ? percentChange(thisMonth.revenueCents, lastMonth.revenueCents) : null;
  const bookingsChange = lastMonth ? percentChange(thisMonth.bookings, lastMonth.bookings) : null;
  const maxRevenue = Math.max(...months.map((m) => m.revenueCents), 1);

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------ CIFRAS */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Ingresos este mes"
          value={formatCents(thisMonth.revenueCents)}
          change={revenueChange}
          hint={lastMonth ? `${formatCents(lastMonth.revenueCents)} el mes pasado` : undefined}
        />
        <Kpi
          label="Citas este mes"
          value={String(thisMonth.bookings)}
          change={bookingsChange}
          hint={thisMonth.newClients > 0 ? `${thisMonth.newClients} clienta${thisMonth.newClients === 1 ? "" : "s"} nueva${thisMonth.newClients === 1 ? "" : "s"}` : undefined}
        />
        <Kpi
          label="Precio medio por cita"
          value={formatCents(stats.averageTicketCents)}
          hint={`${stats.totals.bookings} citas en total`}
        />
        <Kpi
          label="Clientas"
          value={String(stats.totals.clients)}
          hint={`${stats.totals.returningClients} han repetido`}
        />
      </div>

      {/* ------------------------------------------- FACTURADO VS PENDIENTE */}
      <div className="card p-5">
        <p className="eyebrow">Detalle del mes en curso</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <Split
            label="Ya realizado"
            value={formatCents(stats.billedCents)}
            note="citas cuyo día ya ha pasado"
          />
          <Split
            label="Por delante"
            value={formatCents(stats.upcomingCents)}
            note="citas futuras ya reservadas"
          />
          <Split
            label="Señales cobradas"
            value={formatCents(stats.totals.depositsCents)}
            note="en total, no solo este mes"
          />
        </div>
      </div>

      {/* ------------------------------------------------------------ GRÁFICO */}
      <div className="card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="eyebrow">Ingresos por mes</p>
          <p className="text-[12px] text-muted">Últimos 12 meses</p>
        </div>

        <div className="mt-5 overflow-x-auto">
          <div className="flex min-w-[520px] items-end gap-2" style={{ height: CHART_HEIGHT + 46 }}>
            {months.map((month, index) => {
              const isCurrent = index === months.length - 1;
              const height = Math.round((month.revenueCents / maxRevenue) * CHART_HEIGHT);
              return (
                <div key={month.key} className="flex flex-1 flex-col items-center justify-end gap-1.5">
                  {month.revenueCents > 0 && (
                    <span className="text-[10px] font-semibold text-muted">
                      {Math.round(month.revenueCents / 100)}
                    </span>
                  )}
                  <div
                    title={`${month.label}: ${formatCents(month.revenueCents)} · ${month.bookings} citas`}
                    style={{ height: Math.max(height, month.revenueCents > 0 ? 4 : 2) }}
                    className={`w-full rounded-t transition-colors ${
                      isCurrent ? "bg-primary" : month.revenueCents > 0 ? "bg-accent" : "bg-line"
                    }`}
                  />
                  <span
                    className={`text-[10.5px] ${isCurrent ? "font-semibold text-ink" : "text-muted"}`}
                  >
                    {month.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <p className="mt-3 text-[11.5px] text-muted">Cifras en euros. El mes en curso va destacado.</p>
      </div>

      {/* --------------------------------------------- SERVICIOS Y CLIENTAS */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <p className="eyebrow">Lo que más te piden</p>
          <ul className="mt-3 space-y-2.5">
            {stats.topServices.map((service) => {
              const share = Math.round((service.count / stats.totals.bookings) * 100);
              return (
                <li key={service.name}>
                  <div className="flex items-baseline justify-between gap-3 text-[14px]">
                    <span className="min-w-0 truncate text-ink">{service.name}</span>
                    <span className="shrink-0 text-muted">
                      {service.count} · {formatCents(service.revenueCents)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${share}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="card p-5">
          <p className="eyebrow">Clientas que más vuelven</p>
          <ul className="mt-3 divide-y divide-line">
            {stats.topClients.map((client) => (
              <li key={client.email} className="flex items-baseline justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-ink">{client.name}</p>
                  <p className="truncate text-[12px] text-muted">
                    {client.phone} · última visita {client.lastVisit.split("-").reverse().join("/")}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[14px] font-semibold text-ink">
                    {client.visits} {client.visits === 1 ? "cita" : "citas"}
                  </p>
                  <p className="text-[12px] text-muted">{formatCents(client.spentCents)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* -------------------------------------------------------------- NOTAS */}
      <div className="rounded-xl border border-dashed border-line bg-surface px-4 py-3 text-[12.5px] leading-relaxed text-muted">
        <p>
          <strong className="text-ink">Cómo se cuentan estos números.</strong> Suman las citas
          confirmadas y las ya realizadas. Las canceladas no suman, y las que esperan la señal
          tampoco, porque todavía no son una cita en firme.
          {stats.cancellationRate > 0 && ` Se te cancela el ${stats.cancellationRate}% de las citas.`}
        </p>
        {stats.hasEstimated && (
          <p className="mt-1.5">
            Hay citas de servicios con precio «desde», que se guardan por su importe mínimo. Los
            ingresos reales serán iguales o mayores que lo que ves aquí, nunca menores.
          </p>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Kpi({
  label,
  value,
  change,
  hint,
}: {
  label: string;
  value: string;
  change?: number | null;
  hint?: string;
}) {
  return (
    <div className="card p-4">
      <p className="eyebrow">{label}</p>
      <p className="mt-1.5 font-display text-[28px] leading-none text-ink">{value}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {change !== null && change !== undefined && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              change > 0
                ? "bg-green-100 text-green-800"
                : change < 0
                  ? "bg-red-100 text-red-800"
                  : "bg-line text-muted"
            }`}
          >
            {change > 0 ? "▲" : change < 0 ? "▼" : "="} {Math.abs(change)}%
          </span>
        )}
        {hint && <span className="text-[11.5px] text-muted">{hint}</span>}
      </div>
    </div>
  );
}

function Split({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div>
      <p className="text-[13px] text-muted">{label}</p>
      <p className="mt-0.5 font-display text-[22px] leading-none text-ink">{value}</p>
      <p className="mt-1 text-[11.5px] text-muted">{note}</p>
    </div>
  );
}
