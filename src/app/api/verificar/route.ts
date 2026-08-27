import { NextResponse, type NextRequest } from "next/server";
import { prepararCodigo, comprobarCodigo } from "@/lib/verification";
import { verificationCode } from "@/lib/mail/templates";
import { sendAll } from "@/lib/mail/send";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/*
 * POST /api/verificar — dos acciones sobre el mismo email.
 *
 *   { email }          Manda un código, si esa clienta existe.
 *   { email, codigo }  Comprueba el código y devuelve sus datos.
 *
 * Pedir código responde SIEMPRE lo mismo, exista el email o no, y tampoco
 * distingue si se ha pedido hace un momento. Cualquier diferencia en la
 * respuesta convertiría esto en una forma de averiguar quién es clienta.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const codigo = typeof body.codigo === "string" ? body.codigo.trim() : "";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Escribe un email válido." }, { status: 400 });
  }

  /* --- Comprobar el código --------------------------------------------- */
  if (codigo) {
    if (!/^\d{6}$/.test(codigo)) {
      return NextResponse.json({ ok: false, error: "El código son 6 cifras." }, { status: 400 });
    }
    const resultado = await comprobarCodigo(email, codigo);
    if (!resultado.ok) {
      return NextResponse.json({ ok: false, error: resultado.error }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      pase: resultado.pase,
      datos: resultado.datos,
      esNueva: resultado.datos === null,
    });
  }

  /* --- Pedir un código -------------------------------------------------- */
  try {
    const decision = await prepararCodigo(email);
    if (decision.enviar) {
      const correo = verificationCode(decision.codigo);
      await sendAll([{ to: email, kind: "verification_code", ...correo }]);
    }
  } catch (error) {
    // Tampoco se cuenta: un error aquí delataría que ese email existe.
    console.error("[verificar] No se pudo enviar el código:", error);
  }

  return NextResponse.json({ ok: true });
}
