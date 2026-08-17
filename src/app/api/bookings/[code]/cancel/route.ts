import { NextResponse, type NextRequest } from "next/server";
import { cancelBooking } from "@/lib/bookings";

export const runtime = "nodejs";

/** POST /api/bookings/AUR-XXXX/cancel — requiere el token del email. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const token = request.nextUrl.searchParams.get("t") ?? "";

  const result = await cancelBooking(code, token);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });

  return NextResponse.json({ ok: true, alreadyCancelled: result.alreadyCancelled });
}
