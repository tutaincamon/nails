import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, ADMIN_COOKIE_OPTIONS, tokenForPassword } from "@/lib/admin-auth";

export const runtime = "nodejs";

/** POST /api/admin/session — iniciar sesión en el panel. */
export async function POST(request: NextRequest) {
  let password = "";
  try {
    const body = (await request.json()) as { password?: unknown };
    if (typeof body.password === "string") password = body.password;
  } catch {
    // cuerpo vacío o inválido: se trata como contraseña incorrecta
  }

  const token = tokenForPassword(password);
  if (!token) {
    return NextResponse.json({ ok: false, error: "Contraseña incorrecta." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, token, ADMIN_COOKIE_OPTIONS);
  return response;
}

/** DELETE /api/admin/session — cerrar sesión. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, "", { ...ADMIN_COOKIE_OPTIONS, maxAge: 0 });
  return response;
}
