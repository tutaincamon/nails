import type { Metadata } from "next";
import siteConfig from "@config";
import { PedirEnlace } from "@/components/PedirEnlace";

export const metadata: Metadata = {
  title: "Mis citas",
  description: `Consulta y gestiona tus citas en ${siteConfig.business.name}.`,
  robots: { index: false, follow: false },
};

export default function MisCitasPage() {
  return (
    <>
      <div className="border-b border-line bg-surface">
        <div className="section py-10">
          <p className="eyebrow">Mis citas</p>
          <h1 className="mt-2 text-[clamp(2rem,5vw,3rem)]">Consulta tus citas</h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
            Escribe el email con el que reservaste y te envío un enlace para ver tu próxima cita,
            las anteriores y cancelar si lo necesitas. No hace falta ninguna contraseña.
          </p>
        </div>
      </div>

      <div className="section max-w-md py-10 lg:py-14">
        <PedirEnlace />
      </div>
    </>
  );
}
