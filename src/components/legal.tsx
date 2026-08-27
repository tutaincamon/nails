import siteConfig from "@config";
import { ownerEmail } from "@/lib/business";

/*
 * Piezas comunes de las tres páginas legales.
 *
 * La regla que rige todo esto: si faltan los datos fiscales, la página lo dice
 * en alto. Unas condiciones que parecen completas pero no identifican a nadie
 * son peores que no tenerlas, porque dan una seguridad que no existe: quien las
 * lee cree que hay alguien detrás respondiendo, y quien las publicó cree que ya
 * está cumpliendo.
 */

export function datosLegalesCompletos(): boolean {
  const { ownerLegalName, taxId, address } = siteConfig.legal;
  return Boolean(ownerLegalName && taxId && address);
}

export function emailLegal(): string {
  return siteConfig.legal.contactEmail || ownerEmail();
}

/** Un dato fiscal, o una marca bien visible de que falta. */
export function Dato({ valor }: { valor: string }) {
  if (valor) return <>{valor}</>;
  return (
    <mark className="bg-amber-200 px-1 font-semibold text-amber-950">[PENDIENTE DE RELLENAR]</mark>
  );
}

export function AvisoIncompleto() {
  if (datosLegalesCompletos()) return null;
  return (
    <div className="mb-8 border border-amber-300 bg-amber-50 p-4">
      <p className="text-[14px] font-semibold text-amber-900">Esta página está sin terminar</p>
      <p className="mt-1 text-[13.5px] leading-relaxed text-amber-900">
        Faltan los datos fiscales de la profesional. Hasta que se rellenen en{" "}
        <code className="font-mono">config/clients/</code>, este texto no sirve como aviso legal.
      </p>
    </div>
  );
}

export function PaginaLegal({
  titulo,
  actualizado,
  children,
}: {
  titulo: string;
  actualizado: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="border-b border-line bg-surface">
        <div className="section py-10">
          <p className="eyebrow">Información legal</p>
          <h1 className="mt-2 text-[clamp(2rem,5vw,3rem)]">{titulo}</h1>
          <p className="mt-3 text-[13.5px] text-muted">Última actualización: {actualizado}</p>
        </div>
      </div>
      <div className="section max-w-2xl py-10 lg:py-14">
        <AvisoIncompleto />
        <div className="space-y-6 text-[15px] leading-relaxed text-muted [&_h2]:mt-8 [&_h2]:text-[19px] [&_h2]:text-ink [&_li]:mt-1.5 [&_strong]:text-ink [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </div>
    </>
  );
}
