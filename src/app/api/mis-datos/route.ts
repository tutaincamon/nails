import { NextResponse, type NextRequest } from "next/server";
import { leerTestigo } from "@/lib/client-portal";
import { puedeBorrar, tarjetasDe } from "@/lib/client-data";
import { anonymiseClient, forgetCardsForEmail } from "@/lib/db";
import { detachCard } from "@/lib/payments";

export const runtime = "nodejs";

/*
 * POST /api/mis-datos — la clienta quita su tarjeta o borra sus datos.
 *
 * Quién puede: solo quien llega con un testigo válido, es decir, quien ha
 * demostrado por email que ese buzón es suyo. El email NO se coge de lo que
 * mande el navegador, sino de dentro del testigo firmado: si viniera del
 * cuerpo de la petición, cualquiera podría borrar los datos de otra persona.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const testigo = typeof body.testigo === "string" ? body.testigo : "";
  const accion = body.accion === "borrar-todo" ? "borrar-todo" : "quitar-tarjeta";

  const leido = leerTestigo(testigo);
  if (!leido.ok) {
    return NextResponse.json(
      {
        ok: false,
        error:
          leido.motivo === "caducado"
            ? "El enlace ha caducado. Pide uno nuevo desde Mis citas."
            : "Enlace no válido.",
      },
      { status: 401 },
    );
  }

  const email = leido.email;

  /*
   * La comprobación se rehace aquí y no se confía en que la pantalla haya
   * ocultado el botón: entre que se cargó la página y se pulsó, puede haberse
   * reservado una cita nueva.
   */
  const bloqueo = await puedeBorrar(email);
  if (!bloqueo.puede) {
    return NextResponse.json(
      {
        ok: false,
        error:
          bloqueo.motivo === "cita-pendiente"
            ? "Tienes una cita por delante. Cancélala primero o espera a que pase."
            : "Hay una cita reciente sin resolver. Podrás hacerlo en unos días.",
      },
      { status: 409 },
    );
  }

  // Soltar la tarjeta en Stripe antes de olvidarla aquí: si se borra primero la
  // referencia, ya no se sabría cuál soltar y quedaría viva en Stripe.
  for (const metodo of await tarjetasDe(email)) {
    await detachCard(metodo);
  }

  if (accion === "borrar-todo") {
    const citas = await anonymiseClient(email);
    return NextResponse.json({ ok: true, accion, citas });
  }

  await forgetCardsForEmail(email);
  return NextResponse.json({ ok: true, accion });
}
