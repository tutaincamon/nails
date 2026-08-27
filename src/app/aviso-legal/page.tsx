import type { Metadata } from "next";
import siteConfig from "@config";
import { Dato, PaginaLegal, emailLegal } from "@/components/legal";

export const metadata: Metadata = {
  title: "Aviso legal",
  description: `Datos identificativos de ${siteConfig.business.name}.`,
};

const { business, legal } = siteConfig;

export default function AvisoLegalPage() {
  return (
    <PaginaLegal titulo="Aviso legal" actualizado="agosto de 2026">
      <h2>Quién está detrás de esta web</h2>
      <p>
        En cumplimiento de la Ley 34/2002 de servicios de la sociedad de la información y de
        comercio electrónico, estos son los datos de la titular de este sitio:
      </p>
      <ul>
        <li>
          <strong>Titular:</strong> <Dato valor={legal.ownerLegalName} />
        </li>
        <li>
          <strong>NIF:</strong> <Dato valor={legal.taxId} />
        </li>
        <li>
          <strong>Domicilio:</strong> <Dato valor={legal.address} />
        </li>
        <li>
          <strong>Email de contacto:</strong> {emailLegal()}
        </li>
        <li>
          <strong>Actividad:</strong> servicios de manicura y pedicura
          {business.address.area ? ` en ${business.address.area}` : ""}.
        </li>
      </ul>

      <h2>Para qué sirve esta web</h2>
      <p>
        Esta web informa de los servicios disponibles y permite reservar cita. No se venden
        productos ni se cobra el servicio por adelantado a través del sitio.
      </p>

      <h2>Uso del sitio</h2>
      <p>
        Al reservar te comprometes a facilitar datos ciertos y a no usar la web de forma que pueda
        dañarla o impedir que otras personas la usen. Las reservas hechas con datos falsos pueden
        anularse sin aviso.
      </p>

      <h2>Contenidos</h2>
      <p>
        Los textos y las fotografías de trabajos son propiedad de la titular. Puedes compartir
        enlaces a la web, pero no reutilizar las imágenes sin permiso.
      </p>

      <h2>Enlaces a otros sitios</h2>
      <p>
        Esta web enlaza a servicios de terceros —redes sociales y la pasarela de pago— que tienen
        sus propias condiciones. No se responde de sus contenidos.
      </p>

      <h2>Legislación aplicable</h2>
      <p>
        Esta web se rige por la legislación española. Para cualquier reclamación puedes escribir a{" "}
        {emailLegal()}, y siempre te quedan las vías de consumo que te correspondan por ley.
      </p>
    </PaginaLegal>
  );
}
