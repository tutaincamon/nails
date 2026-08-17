import { NextResponse, type NextRequest } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { getEmail } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/emails/3 — devuelve el email tal cual, para verlo en un iframe.
 * Solo con sesión de administradora.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return new NextResponse("Id no válido", { status: 400 });

  const email = await getEmail(id);
  if (!email) return new NextResponse("No encontrado", { status: 404 });

  return new NextResponse(email.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Es contenido almacenado: se muestra siempre dentro de un iframe con sandbox.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}
