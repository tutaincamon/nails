"use client";

import { useRouter } from "next/navigation";
import { olvidarRecuerdoLocal } from "@/components/VerificarEmail";

/*
 * Salida del portal.
 *
 * Con el dispositivo reconocido se entra a "Mis citas" sin pedir nada, y eso
 * en un móvil compartido significa que quien lo coja después vería las citas
 * de la anterior. Esto es la puerta de salida, y por eso está siempre a la
 * vista y no escondida al final.
 */
export function SalirDispositivo() {
  const router = useRouter();

  return (
    <button
      type="button"
      className="text-[13px] text-muted underline underline-offset-2 hover:text-ink"
      onClick={() => {
        olvidarRecuerdoLocal();
        router.push("/mis-citas");
      }}
    >
      No soy yo · salir de este dispositivo
    </button>
  );
}
