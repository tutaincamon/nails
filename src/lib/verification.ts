import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { adminPassword } from "@/lib/admin-auth";
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
  | { enviar: false; motivo: "demasiado-pronto" };

/**
 * Genera el código, para cualquier email.
 *
 * A propósito NO se mira antes si esa clienta existe. Verificar siempre, sea
 * nueva o no, hace dos cosas a la vez: confirma que el buzón es suyo —y de ahí
 * dependen la confirmación, el enlace para cancelar y el aviso del cargo— y,
 * como todo el mundo recibe código, no hay ninguna diferencia observable entre
 * un email conocido y uno que no lo es.
 */
export async function prepararCodigo(email: string): Promise<EnvioResultado> {
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
  | { ok: true; datos: DatosClienta | null; pase: string }
  | { ok: false; error: string };

/* -------------------------------------------------------------------------- */
/*  Pase de email verificado                                                  */
/* -------------------------------------------------------------------------- */

/*
 * Al acertar el código se entrega un pase firmado con ese email dentro. La
 * reserva se guarda con el email del pase y NO con el que venga del formulario:
 * sin esto, cualquiera podría saltarse la verificación mandando una reserva
 * directamente a la API con la dirección de otra persona.
 *
 * Dura 2 horas: lo justo para terminar de reservar sin prisas.
 */
const PASE_MS = 2 * 60 * 60 * 1000;

function firmarPase(carga: string): string {
  return createHash("sha256").update(`${carga}|${adminPassword()}`).digest("hex").slice(0, 32);
}

export function crearPase(email: string, ahora = Date.now()): string {
  const carga = `${email.trim().toLowerCase()}|${ahora + PASE_MS}`;
  return `${Buffer.from(carga, "utf8").toString("base64url")}.${firmarPase(carga)}`;
}

/** Devuelve el email verificado, o null si el pase no vale o ha caducado. */
export function leerPase(pase: string, ahora = Date.now()): string | null {
  const corte = pase.lastIndexOf(".");
  if (corte <= 0) return null;

  let carga: string;
  try {
    carga = Buffer.from(pase.slice(0, corte), "base64url").toString("utf8");
  } catch {
    return null;
  }

  if (!comparar(pase.slice(corte + 1), firmarPase(carga))) return null;

  const sep = carga.lastIndexOf("|");
  if (sep <= 0) return null;
  const caduca = Number(carga.slice(sep + 1));
  if (!Number.isFinite(caduca) || ahora > caduca) return null;

  return carga.slice(0, sep);
}

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
   * Los datos salen de su última cita, no de un perfil guardado aparte: si se
   * mudó, lo que hay que enseñarle es la dirección de la última vez, que es la
   * que reconoce. Aun así se le pide expresamente que la confirme.
   *
   * Si no hay citas, es clienta nueva: no es un error, simplemente se le pedirá
   * todo. Que la respuesta sea la misma en los dos casos —un pase válido— es lo
   * que hace que esto no sirva para averiguar quién es clienta.
   */
  const citas = await bookingsForEmail(email, 1);
  const ultima = citas[0];

  return {
    ok: true,
    pase: crearPase(email),
    datos: ultima
      ? {
          name: ultima.client_name,
          phone: ultima.client_phone,
          address: ultima.client_address,
        }
      : null,
  };
}
