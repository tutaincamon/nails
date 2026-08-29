import { NextResponse, type NextRequest } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { getBooking, setFinalPrice } from "@/lib/db";
import { formatCents, parseEuros } from "@/lib/money";
import { MAX_PRECIO_CENTS } from "@/lib/price";

export const runtime = "nodejs";

/**
 * PUT /api/admin/bookings/AUR-XXXX/precio   body: { euros, nota }
 *
 * Corrige lo que acabó costando una cita. Sirve para los servicios "desde",
 * donde el precio real solo se sabe al ver el diseño, y para los extras que
 * salen sobre la marcha.
 *
 * Solo se permite con la cita ya realizada, y es deliberado: antes de hacer el
 * trabajo no hay nada que ajustar, y poder tocar el precio de una cita futura
 * significaría cambiarle a la clienta un importe que ella ya aceptó y que
 * tiene por escrito en su email.
 *
 * No se le manda ningún email: para cuando esto se toca, el servicio ya está
 * hecho y pagado en mano. Lo verá igualmente en su historial, que es donde
 * tiene sentido mirarlo.
 *
 * Enviar `euros` vacío deshace el ajuste y devuelve la cita a su precio
 * original.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const { code } = await params;
  const booking = await getBooking(code);
  if (!booking) {
    return NextResponse.json({ ok: false, error: "Reserva no encontrada." }, { status: 404 });
  }

  if (booking.status !== "completed") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "El precio solo se ajusta cuando el servicio ya está hecho. " +
          "Marca antes la cita como realizada.",
      },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const texto = typeof body.euros === "string" ? body.euros.trim() : "";
  const nota = (typeof body.nota === "string" ? body.nota : "").trim().slice(0, 200);

  // Vacío = volver al precio de la reserva.
  if (texto === "") {
    await setFinalPrice(code, 0, "");
    return NextResponse.json({ ok: true, cents: 0, deshecho: true });
  }

  const cents = parseEuros(texto);
  if (cents === null || cents <= 0) {
    return NextResponse.json(
      { ok: false, error: "Escribe el precio en euros, por ejemplo 42,50." },
      { status: 400 },
    );
  }
  if (cents > MAX_PRECIO_CENTS) {
    return NextResponse.json(
      {
        ok: false,
        error: `${formatCents(cents)} parece una errata. El máximo que admite es ${formatCents(MAX_PRECIO_CENTS)}.`,
      },
      { status: 400 },
    );
  }

  await setFinalPrice(code, cents, nota);
  return NextResponse.json({ ok: true, cents });
}
