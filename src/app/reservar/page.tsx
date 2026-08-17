import { Suspense } from "react";
import type { Metadata } from "next";
import siteConfig from "@config";
import { BookingWizard } from "@/components/BookingWizard";

export const metadata: Metadata = {
  title: "Reservar cita",
  description: `Elige tu servicio y quédate con el hueco que mejor te venga en ${siteConfig.business.name}.`,
};

export default function ReservarPage() {
  return (
    <>
      <div className="border-b border-line bg-surface">
        <div className="section py-10">
          <p className="eyebrow">Reserva online</p>
          <h1 className="mt-2 text-[clamp(2rem,5vw,3rem)]">Tu cita en cuatro pasos</h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
            Elige servicio, día y hora. Recibirás la confirmación por email al momento y un
            recordatorio el día antes.
          </p>
        </div>
      </div>

      <Suspense fallback={<WizardSkeleton />}>
        <BookingWizard />
      </Suspense>
    </>
  );
}

function WizardSkeleton() {
  return (
    <div className="section grid gap-8 py-10 lg:grid-cols-[1fr_340px] lg:gap-12 lg:py-14">
      <div className="space-y-3">
        <div className="h-9 w-2/3 animate-pulse rounded-lg bg-line/60" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-line/40" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-line/40" />
    </div>
  );
}
