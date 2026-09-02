import { NextResponse, type NextRequest } from "next/server";
import siteConfig from "@config";
import { availabilityRange } from "@/lib/availability";
import { nombreDe, picksFromParam, quote } from "@/lib/catalog";
import { nowInBusinessTz } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/availability?service=semi-color,solo-pedicura&addons=piedras:10&from=2026-08-18&days=14
 *
 * Devuelve los huecos libres de cada día para esa selección concreta, porque la
 * duración cambia según los servicios y los extras elegidos.
 *
 * `service` admite varios separados por comas, y cada extra puede llevar
 * ":cantidad". Un solo servicio sin comas y un extra sin cantidad siguen
 * valiendo, que es como los escribían los enlaces antiguos.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const crudo = params.get("service") ?? params.get("services");
  if (!crudo) {
    return NextResponse.json({ error: "Falta el parámetro 'service'." }, { status: 400 });
  }

  const serviceIds = crudo.split(",").filter(Boolean);
  const q = quote(serviceIds, picksFromParam(params.get("addons") ?? ""));
  if (!q) return NextResponse.json({ error: "Servicio no encontrado." }, { status: 404 });

  const today = nowInBusinessTz().date;
  const from = params.get("from") ?? today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    return NextResponse.json({ error: "Formato de fecha no válido." }, { status: 400 });
  }

  const days = Math.min(Math.max(Number(params.get("days") ?? 14), 1), 60);

  return NextResponse.json({
    service: { id: q.services[0].id, name: nombreDe(q.services) },
    services: q.services.map((s) => ({ id: s.id, name: s.name })),
    durationMin: q.durationMin,
    totalCents: q.totalCents,
    isFrom: q.isFrom,
    depositCents: q.depositCents,
    today,
    maxDaysAhead: siteConfig.booking.maxDaysAhead,
    days: await availabilityRange(from, days, q.durationMin),
  });
}
