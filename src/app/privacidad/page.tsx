import type { Metadata } from "next";
import siteConfig from "@config";
import { Dato, PaginaLegal, emailLegal } from "@/components/legal";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: `Qué datos se recogen en ${siteConfig.business.name} y para qué.`,
};

const { business, legal, venue, booking, noShow } = siteConfig;

export default function PrivacidadPage() {
  return (
    <PaginaLegal titulo="Política de privacidad" actualizado="agosto de 2026">
      <h2>Quién trata tus datos</h2>
      <ul>
        <li>
          <strong>Responsable:</strong> <Dato valor={legal.ownerLegalName} /> (
          <Dato valor={legal.taxId} />)
        </li>
        <li>
          <strong>Dirección:</strong> <Dato valor={legal.address} />
        </li>
        <li>
          <strong>Contacto:</strong> {emailLegal()}
        </li>
      </ul>

      <h2>Qué datos se recogen</h2>
      <p>Solo lo necesario para atender tu cita:</p>
      <ul>
        <li>
          <strong>Nombre, email y teléfono.</strong> Para identificar la reserva, mandarte la
          confirmación y el recordatorio, y poder avisarte si surge un cambio.
        </li>
        {venue.needsClientAddress && (
          <li>
            <strong>Tu dirección.</strong> Porque el servicio es a domicilio y sin ella no se puede
            atender la cita.
          </li>
        )}
        <li>
          <strong>Lo que escribas en las notas.</strong> Lo que tú decidas contar sobre alergias,
          el estado de tus uñas o el diseño que quieres.
        </li>
        {noShow.enabled && (
          <li>
            <strong>Datos de tu tarjeta: no se guardan aquí.</strong> Los pide y los custodia
            Stripe, la pasarela de pago. En esta web solo queda una referencia que sirve para
            cobrar en esa cuenta de Stripe y para nada más. El número de tu tarjeta no pasa por
            este servidor en ningún momento.
          </li>
        )}
      </ul>

      <h2>Para qué se usan y con qué derecho</h2>
      <ul>
        <li>
          <strong>Gestionar tu cita.</strong> Base legal: la relación contractual que se crea al
          reservar.
        </li>
        <li>
          <strong>Enviarte confirmación y recordatorio.</strong> Forman parte del propio servicio.
        </li>
        {noShow.enabled && (
          <li>
            <strong>Cobrar la cita si no acudes o cancelas con menos de{" "}
            {booking.cancellationHours} h.</strong> Base legal: las condiciones que aceptas
            expresamente al reservar, marcando la casilla.
          </li>
        )}
      </ul>
      <p>
        <strong>No se envía publicidad</strong> ni se cede tu información a terceros para que te
        vendan nada.
      </p>

      <h2>Quién más los ve</h2>
      <ul>
        <li>
          <strong>Vercel</strong> (alojamiento) y <strong>Turso</strong> (base de datos), que
          guardan la información por cuenta de la responsable.
        </li>
        <li>
          <strong>El proveedor de correo</strong> que envía las confirmaciones.
        </li>
        {noShow.enabled && (
          <li>
            <strong>Stripe</strong>, que trata los datos de la tarjeta como responsable propio.
          </li>
        )}
      </ul>

      <h2>Cuánto tiempo se guardan</h2>
      <p>
        Los datos de las citas se conservan mientras seas clienta y después el tiempo necesario para
        cumplir las obligaciones fiscales y contables. Puedes pedir que se borren antes si ya no hay
        ninguna obligación pendiente.
      </p>

      <h2>Qué puedes hacer</h2>
      <p>
        Tienes derecho a acceder a tus datos, corregirlos, borrarlos, oponerte a que se traten,
        limitar su uso y llevártelos a otro sitio. Para cualquiera de esas cosas, escribe a{" "}
        <strong>{emailLegal()}</strong> desde el email con el que reservaste.
      </p>
      <p>
        Si crees que no se han tratado bien tus datos, puedes reclamar ante la{" "}
        <strong>Agencia Española de Protección de Datos</strong> (www.aepd.es).
      </p>

      <h2>Datos guardados en tu propio móvil</h2>
      <p>
        Para no hacerte escribir lo mismo cada vez, la web guarda tu nombre, email, teléfono
        {venue.needsClientAddress ? " y dirección" : ""} <strong>en tu propio navegador</strong>.
        Eso no se envía a ningún sitio ni se comparte: está solo en tu dispositivo, y puedes
        borrarlo desde el propio formulario de reserva con el botón «No soy yo, vaciar» o limpiando
        los datos del navegador.
      </p>
    </PaginaLegal>
  );
}
