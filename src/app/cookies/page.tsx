import type { Metadata } from "next";
import siteConfig from "@config";
import { PaginaLegal, emailLegal } from "@/components/legal";

export const metadata: Metadata = {
  title: "Política de cookies",
  description: `Qué guarda ${siteConfig.business.name} en tu dispositivo y para qué.`,
};

const { venue } = siteConfig;

export default function CookiesPage() {
  return (
    <PaginaLegal titulo="Política de cookies" actualizado="agosto de 2026">
      <p>
        Esta web guarda muy poco en tu dispositivo, y aquí está todo lo que guarda. No hay cookies
        de publicidad, ni de redes sociales, ni se comparte nada con anunciantes.
      </p>

      <h2>Lo que se guarda siempre</h2>
      <p>
        Solo lo imprescindible para que la web funcione. Esto no necesita tu permiso porque sin ello
        no se puede prestar el servicio.
      </p>
      <ul>
        <li>
          <strong>Tu respuesta al aviso de cookies.</strong> Para no volver a preguntártelo en cada
          visita.
        </li>
        <li>
          <strong>La sesión del panel de la profesional.</strong> Solo se crea cuando ella entra en
          su zona privada; a ti no se te crea ninguna.
        </li>
      </ul>

      <h2>Lo que se guarda solo si tú lo pides</h2>
      <ul>
        <li>
          <strong>Tus datos de reserva</strong> —nombre, email, teléfono
          {venue.needsClientAddress ? " y dirección" : ""}— para no hacerte escribirlos otra vez.
          Se guarda únicamente si marcas la casilla al reservar. Se queda en tu navegador, no se
          envía a ningún servidor, y puedes borrarlo desde el propio formulario con el botón «No soy
          yo, vaciar».
        </li>
      </ul>

      <h2>Lo que se guarda solo si lo aceptas</h2>
      <ul>
        <li>
          <strong>Medición de visitas (Vercel Analytics).</strong> Sirve para saber cuánta gente
          entra y si algo falla. Es anónima y no usa cookies de seguimiento, pero solo se activa si
          pulsas «Aceptar» en el aviso. Si pulsas «Rechazar», no se carga: no es un aviso decorativo.
        </li>
      </ul>

      <h2>Cambiar de opinión</h2>
      <p>
        Puedes revocar lo que aceptaste borrando los datos de este sitio desde los ajustes de tu
        navegador. La próxima vez que entres, la web volverá a preguntarte.
      </p>

      <h2>Terceros</h2>
      <p>
        Al reservar puedes pasar por la pasarela de pago, que es un servicio externo con su propia
        política de cookies. Esta web no controla lo que ese proveedor guarde durante ese paso.
      </p>

      <h2>Dudas</h2>
      <p>
        Si quieres saber cualquier cosa sobre esto, escribe a <strong>{emailLegal()}</strong>.
      </p>
    </PaginaLegal>
  );
}
