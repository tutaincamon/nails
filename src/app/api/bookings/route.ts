import { NextResponse, type NextRequest } from "next/server";
import { createBooking, type PaymentChoice } from "@/lib/bookings";
import { leerPase } from "@/lib/verification";
import type { AddOnPick } from "@/lib/catalog";

export const runtime = "nodejs";

type Payload = {
  service?: unknown;
  services?: unknown;
  addons?: unknown;
  date?: unknown;
  time?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  pase?: unknown;
  address?: unknown;
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

  /*
   * El email sale del pase firmado, no del formulario. Es lo que impide que
   * alguien reserve a nombre del correo de otra persona mandando una petición
   * directamente a esta ruta: sin haber acertado el código no hay pase, y sin
   * pase no hay reserva.
   */
  const emailVerificado = leerPase(str(payload.pase));
  if (!emailVerificado) {
    return NextResponse.json(
      {
        ok: false,
        error: "Tienes que verificar tu email antes de reservar. Vuelve a empezar el paso de datos.",
        field: "email",
      },
      { status: 401 },
    );
  }

  const payment: PaymentChoice = str(payload.payment) === "deposit" ? "deposit" : "on_site";

  /*
   * Los servicios llegan como lista. Se acepta también el campo antiguo con un
   * solo id, por si queda alguna pestaña abierta con la versión anterior de la
   * página: perder una reserva por eso sería absurdo.
   */
  const serviceIds = Array.isArray(payload.services)
    ? payload.services.filter((s): s is string => typeof s === "string")
    : [str(payload.service)].filter(Boolean);

  /*
   * Cada extra puede venir como texto ("francesa") o con cantidad
   * ({ id: "piedras", units: 10 }). Aquí solo se recoge QUÉ pidió; cuántas
   * caben de verdad y cuánto suman lo decide el catálogo en el servidor.
   */
  const addOns: AddOnPick[] = (Array.isArray(payload.addons) ? payload.addons : []).flatMap(
    (crudo) => {
      if (typeof crudo === "string") return [{ id: crudo, units: 1 }];
      if (crudo && typeof crudo === "object") {
        const { id, units } = crudo as { id?: unknown; units?: unknown };
        if (typeof id === "string") return [{ id, units: Number(units) || 1 }];
      }
      return [];
    },
  );

  const result = await createBooking({
    serviceIds,
    addOns,
    date,
    time,
    name: str(payload.name),
    email: emailVerificado,
    phone: str(payload.phone),
    address: str(payload.address),
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
