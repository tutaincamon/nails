import { NextResponse, type NextRequest } from "next/server";
import { crearTestigo } from "@/lib/client-portal";
import { bookingsForEmail } from "@/lib/db";
import { clientPortalLink } from "@/lib/mail/templates";
import { sendAll } from "@/lib/mail/send";
import { portalUrl } from "@/lib/urls";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/*
 * POST /api/mis-citas — pide por email el enlace a tus citas.
 *
 * Responde SIEMPRE lo mismo, haya citas o no. Si dijera "no tienes ninguna",
 * cualquiera podría ir probando direcciones para averiguar quién es clienta
 * suya, y en un negocio que va a casa de la gente eso no es un detalle menor.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim() : "";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, error: "Escribe un email válido." },
      { status: 400 },
    );
  }

  try {
    const citas = await bookingsForEmail(email, 1);
    if (citas.length > 0) {
      const correo = clientPortalLink(portalUrl(crearTestigo(email)));
      await sendAll([{ to: email, kind: "client_portal", ...correo }]);
    }
  } catch (error) {
    // Un fallo aquí tampoco se cuenta: revelaría que ese email existe.
    console.error("[mis-citas] No se pudo enviar el enlace:", error);
  }

  return NextResponse.json({ ok: true });
}
