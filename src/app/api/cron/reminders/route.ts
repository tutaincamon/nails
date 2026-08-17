import { NextResponse, type NextRequest } from "next/server";
import { sendRemindersFor, sendRemindersForTomorrow } from "@/lib/bookings";
import { isAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * Recordatorios del día antes.
 *
 * Se llama una vez al día. Formas de dispararlo:
 *   · Vercel Cron (ver vercel.json), que envía el header Authorization con CRON_SECRET.
 *   · cron del sistema:  curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/reminders
 *   · el botón del panel /admin (sesión de administradora).
 *
 * Es idempotente: cada reserva guarda reminder_sent_at, así que ejecutarlo
 * varias veces el mismo día no envía emails repetidos.
 */

async function authorize(request: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = request.headers.get("authorization");
    if (header === `Bearer ${secret}`) return true;
  }
  // Sin CRON_SECRET configurado, solo desde el panel con sesión abierta.
  return isAdmin();
}

async function run(request: NextRequest) {
  if (!(await authorize(request))) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  // ?date=YYYY-MM-DD permite forzar un día concreto (útil para probar).
  const date = request.nextUrl.searchParams.get("date");
  const result = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? await sendRemindersFor(date)
    : await sendRemindersForTomorrow();

  console.info(
    `[cron] Recordatorios para ${result.date}: ${result.sent.length} de ${result.found} enviados.`,
  );
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
