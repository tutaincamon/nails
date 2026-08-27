"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import siteConfig from "@config";

/** Botón de cancelación con confirmación en dos pasos. */
export function CancelBooking({ code, token }: { code: string; token: string }) {
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
        Este botón solo aparece cuando aún se está a tiempo, así que aquí la
        noticia es buena: cancela ahora y no se le cobra nada. Decírselo evita
        que se quede con la duda del aviso que aceptó al reservar.
      */}
      {siteConfig.deposit.enabled && (
        <p className="mt-2 text-[13px] leading-relaxed text-red-800">
          Estás a tiempo: quedan más de {siteConfig.booking.cancellationHours} h, así que la señal
          se te devuelve entera
          {siteConfig.noShow.enabled && " y no se te cobra nada más"}.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={cancel}
          disabled={working}
          className="btn-sm bg-red-600 text-white transition-colors hover:bg-red-700 disabled:opacity-50"
        >
          {working ? "Cancelando…" : "Sí, cancelar"}
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
