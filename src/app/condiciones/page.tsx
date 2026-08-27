import type { Metadata } from "next";
import siteConfig from "@config";
import { PaginaLegal, emailLegal } from "@/components/legal";

export const metadata: Metadata = {
  title: "Condiciones de reserva",
  description: `Cómo funcionan las reservas y las cancelaciones en ${siteConfig.business.name}.`,
};

const { business, booking, deposit, noShow, venue, content } = siteConfig;

export default function CondicionesPage() {
  return (
    <PaginaLegal titulo="Condiciones de reserva" actualizado="agosto de 2026">
      <p>
        Esto es lo que aceptas al reservar. Está escrito para entenderse a la primera, sin letra
        pequeña: lo que dice aquí es exactamente lo que se aplica.
      </p>

      <h2>Reservar</h2>
      <ul>
        <li>
          Puedes reservar con hasta {booking.maxDaysAhead} días de antelación, y como mínimo{" "}
          {booking.minNoticeHours} h antes de la cita.
        </li>
        <li>
          {deposit.enabled ? (
            <>Se pide una señal de reserva que se descuenta del precio final.</>
          ) : (
            <>
              <strong>Reservar es gratis.</strong> No se te cobra nada al reservar.
            </>
          )}
        </li>
        {noShow.enabled && (
          <li>
            Se te pide registrar una tarjeta para asegurar el hueco.{" "}
            <strong>No se le hace ningún cargo</strong> en ese momento: solo queda guardada para el
            caso descrito más abajo.
          </li>
        )}
        <li>
          El precio de cada servicio aparece en la web. Los marcados como «desde» pueden subir según
          el diseño; si mandas la referencia antes, se te confirma el precio exacto.
        </li>
      </ul>

      <h2>Cancelar</h2>
      <ul>
        <li>
          <strong>
            Hasta {booking.cancellationHours} h antes: cancelas sin coste
            {deposit.enabled ? " y se te devuelve la señal" : ""}.
          </strong>{" "}
          Puedes hacerlo desde el enlace del email de confirmación.
        </li>
        {noShow.enabled && (
          <li>
            <strong>
              Con menos de {booking.cancellationHours} h, o si no acudes: se cobra el{" "}
              {noShow.chargePercent} % del precio del servicio
            </strong>{" "}
            a la tarjeta que registraste. La web te enseña el importe exacto en euros antes de que
            confirmes la cancelación.
          </li>
        )}
        <li>
          Si te surge un imprevisto de fuerza mayor, escríbeme y lo hablamos: el cobro no es
          automático, lo decide la profesional caso por caso.
        </li>
      </ul>

      {noShow.enabled && (
        <>
          <h2>Por qué existe esa condición</h2>
          <p>
            {venue.needsClientAddress
              ? "El servicio es a domicilio: una cita a la que no se acude no es solo una hora perdida, es también el desplazamiento y el hueco que otra persona no pudo coger."
              : "Una cita a la que no se acude es una hora perdida que otra persona no pudo reservar."}{" "}
            Registrar la tarjeta no le cuesta nada a quien piensa venir.
          </p>
        </>
      )}

      <h2>Puntualidad</h2>
      <p>
        Si vas a llegar tarde, avisa cuanto antes. Se puede esperar unos 15 minutos; a partir de ahí
        quizá haya que simplificar el diseño o mover la cita, porque después hay otra clienta.
      </p>

      {content.policies.length > 0 && (
        <>
          <h2>Antes de la cita</h2>
          <ul>
            {content.policies.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </>
      )}

      <h2>Dudas y reclamaciones</h2>
      <p>
        Para cualquier cosa relacionada con tu cita o con estas condiciones, escribe a{" "}
        <strong>{emailLegal()}</strong>. {business.name} responde a todas.
      </p>
    </PaginaLegal>
  );
}
