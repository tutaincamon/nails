import { NextResponse, type NextRequest } from "next/server";
import siteConfig from "@config";
import { availabilityRange } from "@/lib/availability";
import { quote } from "@/lib/catalog";
import { nowInBusinessTz } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/availability?service=semi-color&addons=semi-largas&from=2026-08-18&days=14
 *
 * Devuelve los huecos libres de cada día para ese servicio concreto, porque la
 * duración cambia según el servicio y los extras elegidos.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const serviceId = params.get("service");
  if (!serviceId) {
    return NextResponse.json({ error: "Falta el parámetro 'service'." }, { status: 400 });
  }

  const addOnIds = (params.get("addons") ?? "").split(",").filter(Boolean);
  const q = quote(serviceId, addOnIds);
  if (!q) return NextResponse.json({ error: "Servicio no encontrado." }, { status: 404 });

  const today = nowInBusinessTz().date;
  const from = params.get("from") ?? today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    return NextResponse.json({ error: "Formato de fecha no válido." }, { status: 400 });
  }

  const days = Math.min(Math.max(Number(params.get("days") ?? 14), 1), 60);

  return NextResponse.json({
    service: { id: q.service.id, name: q.service.name },
    durationMin: q.durationMin,
    totalCents: q.totalCents,
    isFrom: q.isFrom,
    depositCents: q.depositCents,
    today,
    maxDaysAhead: siteConfig.booking.maxDaysAhead,
    days: await availabilityRange(from, days, q.durationMin),
  });
}
