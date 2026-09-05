import { appflu } from "./clients/appflu";

export type { Service, ServiceCategory, AddOn, TimeRange, Zone } from "./clients/appflu";
import { isis } from "./clients/isis";
import { luamiz } from "./clients/luamiz";

/* ============================================================================
 *  QUÉ PROFESIONAL SE MUESTRA
 * ============================================================================
 *
 *  Un mismo código sirve a varias profesionales. Cada una tiene su archivo en
 *  clients/ y se elige con la variable de entorno NEXT_PUBLIC_CLIENT_ID.
 *
 *  Va con prefijo NEXT_PUBLIC_ a propósito: la configuración la usan también
 *  los componentes que corren en el navegador (el asistente de reserva, la
 *  carta de servicios), y sin ese prefijo Next no la incluye en el paquete que
 *  se descarga la clienta, así que todas verían siempre la de Appflu.
 *
 *  Cada profesional se despliega como su propio proyecto, con su propia base
 *  de datos y su propio dominio. Nunca comparten datos: es lo que hace
 *  imposible que las clientas de una acaben viéndose en la agenda de otra.
 *
 *  Para dar de alta a alguien nuevo:
 *    1. Copia clients/appflu.ts, cámbiale lo suyo.
 *    2. Añádela aquí abajo.
 *    3. Despliega con NEXT_PUBLIC_CLIENT_ID=<su id>.
 * ========================================================================== */

const clients = { appflu, isis, luamiz };

export type ClientId = keyof typeof clients;

const requested = process.env.NEXT_PUBLIC_CLIENT_ID as ClientId | undefined;

if (requested && !(requested in clients)) {
  // Un identificador mal escrito dejaría la web de una profesional mostrando
  // la marca de otra sin que nadie se diera cuenta. Mejor romper el despliegue.
  throw new Error(
    `NEXT_PUBLIC_CLIENT_ID="${requested}" no existe. Disponibles: ${Object.keys(clients).join(", ")}`,
  );
}

export const siteConfig = requested ? clients[requested] : appflu;

/** Identificador activo, útil para depurar un despliegue. */
export const clientId: ClientId = requested ?? "appflu";

export type SiteConfig = typeof appflu;
export default siteConfig;
