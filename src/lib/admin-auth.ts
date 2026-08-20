import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/*
 * Autenticación del panel: una sola contraseña, guardada en ADMIN_PASSWORD.
 * La cookie no contiene la contraseña, sino un HMAC derivado de ella, así que
 * cambiar la contraseña invalida las sesiones abiertas.
 *
 * Es suficiente para un negocio de una persona. Si algún día hay varias
 * profesionales, aquí es donde se sustituye por usuarios reales.
 */

export const ADMIN_COOKIE = "studio_admin";
const DEFAULT_PASSWORD = "demo1234";

export function adminPassword(): string {
  return env("ADMIN_PASSWORD") || DEFAULT_PASSWORD;
}

/** true cuando se está usando la contraseña de ejemplo (avisar en pantalla). */
export function usingDefaultPassword(): boolean {
  return !env("ADMIN_PASSWORD");
}

function expectedToken(): string {
  return createHmac("sha256", adminPassword()).update("panel-agenda-v1").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function tokenForPassword(password: string): string | null {
  return safeEqual(password, adminPassword()) ? expectedToken() : null;
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  const value = store.get(ADMIN_COOKIE)?.value;
  if (!value) return false;
  return safeEqual(value, expectedToken());
}

export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 12,
};
