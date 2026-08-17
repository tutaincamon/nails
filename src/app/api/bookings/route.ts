import { NextResponse, type NextRequest } from "next/server";
import { createBooking, type PaymentChoice } from "@/lib/bookings";

export const runtime = "nodejs";

type Payload = {
  service?: unknown;
  addons?: unknown;
  date?: unknown;
  time?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  notes?: unknown;
  payment?: unknown;
};

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** POST /api/bookings — crea la reserva y dispara los emails correspondientes. */
export async function POST(request: NextRequest) {
  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: "Petición no válida." }, { status: 400 });
  }

  const date = str(payload.date);
  const time = str(payload.time);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return NextResponse.json(
      { ok: false, error: "Elige un día y una hora para la cita.", field: "time" },
      { status: 400 },
    );
  }

  const payment: PaymentChoice = str(payload.payment) === "deposit" ? "deposit" : "on_site";
  const addons = Array.isArray(payload.addons) ? payload.addons.filter((a) => typeof a === "string") : [];

  const result = await createBooking({
    serviceId: str(payload.service),
    addOnIds: addons as string[],
    date,
    time,
    name: str(payload.name),
    email: str(payload.email),
    phone: str(payload.phone),
    notes: str(payload.notes),
    payment,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, field: result.field },
      // 409: el hueco se ocupó mientras rellenaba el formulario.
      { status: result.field === "time" ? 409 : 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    code: result.booking.code,
    token: result.booking.manage_token,
    needsPayment: result.needsPayment,
    next: result.needsPayment ? result.payUrl : result.manageUrl,
  });
}
