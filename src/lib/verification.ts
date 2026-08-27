import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import {
  bookingsForEmail,
  bumpCodeAttempts,
  deleteCode,
  getCode,
  saveCode,
} from "@/lib/db";

/*
 * Códigos de un solo uso para reconocer a una clienta que ya ha venido.
 *
 * El problema que resuelve, y por qué no basta con escribir el email: si
 * teclear una dirección bastara para que salieran el nombre, el teléfono y la
 * DIRECCIÓN DE CASA de esa persona, cualquiera podría sacar la lista de
 * clientas probando correos. En un negocio que va al domicilio de la gente eso
 * no es una molestia, es un problema de seguridad. Por eso hay que demostrar
 * que ese buzón es tuyo antes de que la web te devuelva nada.
 *
 * Decisiones que conviene no aflojar:
 *   · 10 minutos de vigencia. Es un código de 6 cifras: cuanto menos tiempo
 *     esté vivo, menos sirve probarlo a ciegas.
 *   · 5 intentos y se acabó. Sin esto, 6 cifras se agotan a fuerza de probar.
 *   · Se guarda el hash, nunca el código.
 *   · Pedir código responde siempre igual, exista el email o no.
 */

const VIGENCIA_MIN = 10;
const MAX_INTENTOS = 5;
/** Un código nuevo cada 60 s como mucho, para no convertir esto en un altavoz. */
const ESPERA_ENTRE_ENVIOS_S = 60;

function hash(codigo: string): string {
  return createHash("sha256").update(codigo).digest("hex");
}

function comparar(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export type EnvioResultado =
  | { enviar: true; codigo: string }
  | { enviar: false; motivo: "sin-citas" | "demasiado-pronto" };

/**
 * Decide si toca mandar un código y lo genera.
 *
 * Quien llama a esto NO debe contarle a la clienta cuál fue el motivo de no
 * enviarlo: por fuera, pedir código siempre responde lo mismo.
 */
export async function prepararCodigo(email: string): Promise<EnvioResultado> {
  const citas = await bookingsForEmail(email, 1);
  if (citas.length === 0) return { enviar: false, motivo: "sin-citas" };

  const anterior = await getCode(email);
  if (anterior) {
    const desde = (Date.now() - new Date(anterior.created_at).getTime()) / 1000;
    if (desde < ESPERA_ENTRE_ENVIOS_S) return { enviar: false, motivo: "demasiado-pronto" };
  }

  // randomInt es aleatorio de verdad; Math.random() no sirve para esto.
  const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const caduca = new Date(Date.now() + VIGENCIA_MIN * 60 * 1000).toISOString();
  await saveCode(email, hash(codigo), caduca);

  return { enviar: true, codigo };
}

export type DatosClienta = { name: string; phone: string; address: string };

export type ComprobarResultado =
  | { ok: true; datos: DatosClienta }
  | { ok: false; error: string };

/** Comprueba el código y, si vale, devuelve los datos de su última cita. */
export async function comprobarCodigo(
  email: string,
  codigo: string,
): Promise<ComprobarResultado> {
  const guardado = await getCode(email);
  if (!guardado) {
    return { ok: false, error: "No hay ningún código pendiente. Pide uno nuevo." };
  }

  if (new Date(guardado.expires_at).getTime() < Date.now()) {
    await deleteCode(email);
    return { ok: false, error: "El código ha caducado. Pide uno nuevo." };
  }

  if (guardado.attempts >= MAX_INTENTOS) {
    await deleteCode(email);
    return { ok: false, error: "Demasiados intentos. Pide un código nuevo." };
  }

  if (!comparar(hash(codigo.trim()), guardado.code_hash)) {
    await bumpCodeAttempts(email);
    const quedan = MAX_INTENTOS - guardado.attempts - 1;
    return {
      ok: false,
      error:
        quedan > 0
          ? `Ese código no es. Te quedan ${quedan} intento${quedan === 1 ? "" : "s"}.`
          : "Ese código no es y se han agotado los intentos. Pide uno nuevo.",
    };
  }

  // Válido: se quema el código antes de devolver nada.
  await deleteCode(email);

  /*
   * Los datos salen de su última cita, no de un perfil: si se mudó, lo que hay
   * que rellenar es la dirección de la última vez, que es la que ella reconoce.
   * Aun así se le pide expresamente que la confirme antes de seguir.
   */
  const citas = await bookingsForEmail(email, 1);
  const ultima = citas[0];
  if (!ultima) return { ok: false, error: "No encuentro citas con este email." };

  return {
    ok: true,
    datos: {
      name: ultima.client_name,
      phone: ultima.client_phone,
      address: ultima.client_address,
    },
  };
}
