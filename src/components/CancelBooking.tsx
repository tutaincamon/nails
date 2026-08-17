"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <p className="text-[14px] font-semibold text-red-900">¿Seguro que quieres cancelar?</p>
      <p className="mt-1 text-[13px] leading-relaxed text-red-800">
        El hueco quedará libre para otra persona y no se puede recuperar: habría que reservar de
        nuevo.
      </p>
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
