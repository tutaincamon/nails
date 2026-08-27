"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import siteConfig from "@config";
import { formatCents } from "@/lib/money";

/**
 * Botón de cancelación con confirmación en dos pasos.
 *
 * `cargoCents` es lo que se le cobrará por cancelar ahora: 0 si está a tiempo.
 * Se pasa ya calculado desde el servidor para que la cifra que ve sea la misma
 * que la que se le cobraría de verdad.
 */
export function CancelBooking({
  code,
  token,
  cargoCents = 0,
}: {
  code: string;
  token: string;
  cargoCents?: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setWorking(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/bookings/${encodeURIComponent(code)}/cancel?t=${encodeURIComponent(token)}`,
        { method: "POST" },
      );
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "No se pudo cancelar la cita.");
        return;
      }
      router.refresh();
    } catch {
      setError("Problema de conexión. Inténtalo otra vez.");
    } finally {
      setWorking(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <div>
        <button type="button" className="btn-ghost btn-sm" onClick={() => setConfirming(true)}>
          Cancelar la cita
        </button>
        {error && (
          <p role="alert" className="mt-3 text-[13px] text-red-700">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="border border-red-200 bg-red-50 p-4">
      <p className="text-[14px] font-semibold text-red-900">¿Seguro que quieres cancelar?</p>
      <p className="mt-1 text-[13px] leading-relaxed text-red-800">
        El hueco quedará libre para otra persona y no se puede recuperar: habría que reservar de
        nuevo.
      </p>

      {/*
        La cifra, en euros y en grande. "Se cobra el 100 %" no le dice nada a
        quien está a punto de pulsar: lo que necesita saber es cuánto.
      */}
      {cargoCents > 0 ? (
        <p className="mt-3 border border-red-300 bg-white px-3 py-2.5 text-[14px] leading-relaxed text-red-900">
          Estás cancelando con menos de {siteConfig.booking.cancellationHours} h de antelación, así
          que <strong>se te cobrarán {formatCents(cargoCents)}</strong> a la tarjeta que dejaste al
          reservar.
        </p>
      ) : (
        <p className="mt-2 text-[13px] leading-relaxed text-red-800">
          Estás a tiempo: quedan más de {siteConfig.booking.cancellationHours} h, así que no se te
          cobra nada
          {siteConfig.deposit.enabled && " y la señal se te devuelve entera"}.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={cancel}
          disabled={working}
          className="btn-sm bg-red-600 text-white transition-colors hover:bg-red-700 disabled:opacity-50"
        >
          {working
            ? "Cancelando…"
            : cargoCents > 0
              ? `Sí, cancelar y pagar ${formatCents(cargoCents)}`
              : "Sí, cancelar"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={working}
          className="btn-ghost btn-sm"
        >
          No, mantener la cita
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-[13px] font-medium text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
