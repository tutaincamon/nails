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
        Los textos, el logotipo y las fotografías de trabajos son propiedad de la titular. Puedes
        navegar y compartir enlaces a la web libremente, pero no copiar, publicar ni reutilizar las
        imágenes o los textos sin permiso.
      </p>

      <h2>Información de la web y disponibilidad</h2>
      <p>
        Se procura que los precios, las duraciones y la disponibilidad estén siempre al día, pero no
        se puede garantizar que no haya errores puntuales ni que el sitio funcione sin
        interrupciones. Si detectas algo que no cuadra, avisa a {emailLegal()} y se corrige. No se
        responde de los daños que puedan derivarse de un uso incorrecto de la información publicada.
      </p>

      <h2>Enlaces a otros sitios</h2>
      <p>
        Esta web enlaza a servicios de terceros —redes sociales y la pasarela de pago— que tienen
        sus propias condiciones y sus propias políticas de privacidad. Se eligen plataformas
        conocidas, pero no se responde de su contenido ni de su funcionamiento.
      </p>

      <h2>Tus datos</h2>
      <p>
        Los datos que dejas al reservar se tratan solo para atender tu cita y para lo que hayas
        autorizado expresamente. Todos los detalles están en la{" "}
        <a href="/privacidad" className="font-medium text-primary underline underline-offset-2">
          política de privacidad
        </a>
        .
      </p>

      <h2>Tus derechos como consumidora</h2>
      <p>
        Te amparan todos los derechos que reconoce la legislación española de consumo: información
        clara del precio y de las condiciones antes de reservar, y las garantías que correspondan al
        servicio prestado.
      </p>
      <p>
        Ten en cuenta que las citas se reservan para un día y una hora concretos, así que lo que se
        aplica para anularlas son las{" "}
        <a href="/condiciones" className="font-medium text-primary underline underline-offset-2">
          condiciones de reserva
        </a>{" "}
        que aceptas al reservar, donde están los plazos de cancelación y lo que ocurre si no acudes.
      </p>

      <h2>Si surge un problema</h2>
      <p>
        Escribe a <strong>{emailLegal()}</strong> y se intentará resolver directamente y cuanto
        antes. Si no quedas conforme, tienes a tu disposición la plataforma de resolución de
        litigios en línea de la Unión Europea:
      </p>
      <p>
        <a
          href="https://ec.europa.eu/consumers/odr/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary underline underline-offset-2"
        >
          ec.europa.eu/consumers/odr
        </a>
      </p>

      <h2>Legislación aplicable</h2>
      <p>
        Esta web se rige por la legislación española. En caso de conflicto, si eres consumidora
        puedes acudir a los juzgados que correspondan a tu propio domicilio.
      </p>
    </PaginaLegal>
  );
}
