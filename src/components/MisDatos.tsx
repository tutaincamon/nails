"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/*
 * Quitar la tarjeta y borrar la cuenta.
 *
 * Se enseña siempre, también cuando no se puede: si el bloque desapareciera al
 * tener una cita, la clienta pensaría que la opción no existe. Es mejor que vea
 * el botón desactivado y el motivo por el que lo está.
 */

type Props = {
  testigo: string;
  tieneTarjeta: boolean;
  bloqueo: { puede: true } | { puede: false; motivo: "cita-pendiente" | "cargo-pendiente" };
};

export function MisDatos({ testigo, tieneTarjeta, bloqueo }: Props) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState<null | "quitar-tarjeta" | "borrar-todo">(null);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<null | "quitar-tarjeta" | "borrar-todo">(null);

  async function ejecutar(accion: "quitar-tarjeta" | "borrar-todo") {
    setTrabajando(true);
    setError(null);
    try {
      const r = await fetch("/api/mis-datos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testigo, accion }),
      });
      const d = (await r.json()) as { ok: boolean; error?: string };
      if (!d.ok) {
        setError(d.error ?? "No se pudo completar.");
        return;
      }
      setHecho(accion);
      if (accion === "quitar-tarjeta") router.refresh();
    } catch {
      setError("Problema de conexión. Inténtalo otra vez.");
    } finally {
      setTrabajando(false);
      setConfirmando(null);
    }
  }

  if (hecho === "borrar-todo") {
    return (
      <section className="mt-12 border border-line bg-surface p-6">
        <h2 className="text-[19px]">Tus datos se han borrado</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          Se han eliminado tu nombre, email, teléfono, dirección y tarjeta. De las citas ya
          atendidas solo se conserva la fecha, el servicio y el importe, sin nada que te
          identifique, porque la ley obliga a guardar ese registro contable.
        </p>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          Este enlace ya no sirve. Si algún día quieres volver, reserva como la primera vez.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-12 border-t border-line pt-8">
      <h2 className="text-[19px]">Tus datos</h2>

      {!bloqueo.puede && (
        <p className="mt-3 border border-amber-300 bg-amber-50 px-4 py-3 text-[13.5px] leading-relaxed text-amber-900">
          {bloqueo.motivo === "cita-pendiente"
            ? "Ahora mismo no puedes quitar la tarjeta ni borrar tus datos porque tienes una cita por delante. Cancélala primero, o espera a que pase."
            : "Hay una cita reciente pendiente de resolver. Podrás hacerlo dentro de unos días."}
        </p>
      )}

      <div className="mt-5 space-y-5">
        {/* --- Quitar la tarjeta --- */}
        <div>
          <p className="text-[14.5px] font-semibold text-ink">Quitar mi tarjeta</p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-muted">
            {tieneTarjeta
              ? "Se olvida la tarjeta guardada, aquí y en la pasarela de pago. Tus citas anteriores se mantienen."
              : "No tienes ninguna tarjeta guardada ahora mismo."}
          </p>
          {confirmando === "quitar-tarjeta" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                disabled={trabajando}
                onClick={() => ejecutar("quitar-tarjeta")}
              >
                {trabajando ? "Quitando…" : "Sí, quitar la tarjeta"}
              </button>
              <button
                type="button"
                className="btn-ghost btn-sm"
                disabled={trabajando}
                onClick={() => setConfirmando(null)}
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn-ghost btn-sm mt-3"
              disabled={!bloqueo.puede || !tieneTarjeta || hecho === "quitar-tarjeta"}
              onClick={() => setConfirmando("quitar-tarjeta")}
            >
              {hecho === "quitar-tarjeta" ? "Tarjeta quitada" : "Quitar mi tarjeta"}
            </button>
          )}
        </div>

        {/* --- Borrar todo --- */}
        <div className="border-t border-line pt-5">
          <p className="text-[14.5px] font-semibold text-ink">Borrar mis datos</p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-muted">
            Se borran tu nombre, email, teléfono, dirección, notas y tarjeta. De las citas ya
            atendidas queda solo la fecha, el servicio y el importe —sin nada que te
            identifique—, porque hay que conservar ese registro contable por ley.{" "}
            <strong className="text-ink">No se puede deshacer.</strong>
          </p>
          {confirmando === "borrar-todo" ? (
            <div className="mt-3 border border-red-200 bg-red-50 p-4">
              <p className="text-[14px] font-semibold text-red-900">
                ¿Seguro que quieres borrar tus datos?
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-red-800">
                Perderás el acceso a tu historial y este enlace dejará de funcionar.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                  disabled={trabajando}
                  onClick={() => ejecutar("borrar-todo")}
                >
                  {trabajando ? "Borrando…" : "Sí, borrar mis datos"}
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  disabled={trabajando}
                  onClick={() => setConfirmando(null)}
                >
                  No, mantenerlos
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn-sm mt-3 border border-line text-red-700 transition-colors hover:border-red-300 hover:bg-red-50 disabled:opacity-40"
              disabled={!bloqueo.puede}
              onClick={() => setConfirmando("borrar-todo")}
            >
              Borrar mis datos
            </button>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-[13.5px] text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
