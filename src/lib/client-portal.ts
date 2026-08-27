import { createHmac, timingSafeEqual } from "node:crypto";
import { adminPassword } from "@/lib/admin-auth";

/*
 * Acceso de la clienta a su listado de citas, sin cuenta ni contraseña.
 *
 * Cómo funciona: escribe su email, le llega un enlace y ese enlace le abre sus
 * citas. El enlace lleva su email y una fecha de caducidad firmados, así que el
 * servidor puede comprobar que lo emitió él sin guardar nada en la base de
 * datos: no hay tabla de sesiones que mantener ni que limpiar.
 *
 * Dos decisiones que conviene no deshacer sin pensarlo:
 *
 *   · Caduca a las 72 h. Estos enlaces acaban en bandejas de entrada que se
 *     comparten, se reenvían y se quedan ahí para siempre.
 *   · Al pedirlo, la web responde lo mismo exista o no ese email. Si dijera
 *     "no tienes citas", cualquiera podría averiguar quién es clienta suya
 *     probando direcciones.
 */

const VIGENCIA_MS = 72 * 60 * 60 * 1000;

/*
 * Se firma con la contraseña del panel: es un secreto que ya existe en todos
 * los despliegues. La firma es de ida y vuelta imposible, así que de un enlace
 * no se puede sacar la contraseña. Y cambiarla invalida los enlaces vivos, que
 * es justo lo que se querría si alguna vez hubiera que cortar por lo sano.
 */
function firmar(carga: string): string {
  return createHmac("sha256", adminPassword()).update(carga).digest("hex").slice(0, 32);
}

function comparar(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Genera el testigo que viaja en el enlace del email. */
export function crearTestigo(email: string, ahora = Date.now()): string {
  const carga = `${email.trim().toLowerCase()}|${ahora + VIGENCIA_MS}`;
  const cuerpo = Buffer.from(carga, "utf8").toString("base64url");
  return `${cuerpo}.${firmar(carga)}`;
}

export type TestigoLeido =
  | { ok: true; email: string }
  | { ok: false; motivo: "caducado" | "invalido" };

/** Comprueba el testigo y devuelve de quién es. */
export function leerTestigo(testigo: string, ahora = Date.now()): TestigoLeido {
  const corte = testigo.lastIndexOf(".");
  if (corte <= 0) return { ok: false, motivo: "invalido" };

  const cuerpo = testigo.slice(0, corte);
  const firma = testigo.slice(corte + 1);

  let carga: string;
  try {
    carga = Buffer.from(cuerpo, "base64url").toString("utf8");
  } catch {
    return { ok: false, motivo: "invalido" };
  }

  // La firma se comprueba SIEMPRE antes de hacer caso a nada del contenido.
  if (!comparar(firma, firmar(carga))) return { ok: false, motivo: "invalido" };

  const separador = carga.lastIndexOf("|");
  if (separador <= 0) return { ok: false, motivo: "invalido" };

  const email = carga.slice(0, separador);
  const caduca = Number(carga.slice(separador + 1));
  if (!Number.isFinite(caduca)) return { ok: false, motivo: "invalido" };
  if (ahora > caduca) return { ok: false, motivo: "caducado" };

  return { ok: true, email };
}
