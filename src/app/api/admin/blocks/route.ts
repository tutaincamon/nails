import { NextResponse, type NextRequest } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { addBlock, deleteBlock } from "@/lib/db";
import { toMinutes } from "@/lib/time";

export const runtime = "nodejs";

/** POST /api/admin/blocks — bloquear un rato de la agenda (médico, descanso...). */
export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const date = typeof body.date === "string" ? body.date : "";
  const start = typeof body.start === "string" ? body.start : "";
  const end = typeof body.end === "string" ? body.end : "";
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 200) : "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, error: "Fecha no válida." }, { status: 400 });
  }
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
    return NextResponse.json({ ok: false, error: "Horas no válidas." }, { status: 400 });
  }
  if (toMinutes(end) <= toMinutes(start)) {
    return NextResponse.json(
      { ok: false, error: "La hora de fin debe ser posterior a la de inicio." },
      { status: 400 },
    );
  }

  addBlock(date, start, end, reason);
  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/blocks?id=3 — quitar un bloqueo. */
export async function DELETE(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const id = Number(request.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "Id no válido." }, { status: 400 });
  }

  deleteBlock(id);
  return NextResponse.json({ ok: true });
}
