"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/*
 * Dos modos de pago:
 *
 *   Stripe real  Se crea la sesión de Checkout en el servidor y se redirige.
 *                Con clave de test se prueba con las tarjetas de prueba de Stripe.
 *   Simulado     No se pide ni se procesa NINGÚN dato de tarjeta: solo dos
 *                botones para simular que el cobro sale bien o se rechaza, y así
 *                poder recorrer el flujo completo en el prototipo.
 */

export function PaymentPanel({
  code,
  token,
  amountLabel,
  stripeReady,
}: {
  code: string;
  token: string;
  amountLabel: string;
  stripeReady: boolean;
}) {
  const router = useRouter();
  const [working, setWorking] = useState<null | "pay" | "decline">(null);
  const [error, setError] = useState<string | null>(null);

  const query = `?t=${encodeURIComponent(token)}`;

  async function payWithStripe() {
    setWorking("pay");
    setError(null);
    try {
      const response = await fetch(`/api/checkout/${encodeURIComponent(code)}${query}`, {
        method: "POST",
      });
      const data = (await response.json()) as {
        ok: boolean;
        mode?: string;
        url?: string;
        error?: string;
      };

      if (!data.ok) {
        setError(data.error ?? "No se pudo iniciar el pago.");
        return;
      }
      if (data.mode === "already_paid" || data.mode === "not_required") {
        router.push(`/reserva/${code}${query}`);
        return;
      }
      if (data.mode === "stripe" && data.url) {
        window.location.href = data.url;
        return;
      }
      setError("La pasarela de pago no está disponible ahora mismo.");
    } catch {
      setError("Problema de conexión. Inténtalo otra vez.");
    } finally {
      setWorking(null);
    }
  }

  async function simulate(outcome: "success" | "declined") {
    setWorking(outcome === "success" ? "pay" : "decline");
    setError(null);
    try {
      const response = await fetch(`/api/demo-pay/${encodeURIComponent(code)}${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };

      if (!data.ok) {
        setError(data.error ?? "El pago no se pudo completar.");
        return;
      }
      router.push(`/reserva/${code}${query}`);
    } catch {
      setError("Problema de conexión. Inténtalo otra vez.");
    } finally {
      setWorking(null);
    }
  }

  return (
    <div>
      {stripeReady ? (
        <button
          type="button"
          className="btn-primary w-full sm:w-auto"
          disabled={working !== null}
          onClick={payWithStripe}
        >
          {working ? "Abriendo pago seguro…" : `Pagar ${amountLabel}`}
        </button>
      ) : (
        <div className="border-2 border-dashed border-accent bg-surface p-5">
          <p className="inline-block bg-accent/25 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-dark">
            Modo demostración
          </p>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">
            Este prototipo no tiene pasarela de pago conectada, así que{" "}
            <strong className="text-ink">no se pide ni se procesa ningún dato de tarjeta</strong>. Usa
            los botones para simular el resultado del cobro y ver el resto del flujo.
          </p>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="btn-primary"
              disabled={working !== null}
              onClick={() => simulate("success")}
            >
              {working === "pay" ? "Procesando…" : `Simular pago correcto (${amountLabel})`}
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={working !== null}
              onClick={() => simulate("declined")}
            >
              {working === "decline" ? "Procesando…" : "Simular pago rechazado"}
            </button>
          </div>

          <p className="mt-4 border-t border-line pt-3 text-[12.5px] leading-relaxed text-muted">
            Para cobrar de verdad basta con añadir <code className="font-mono">STRIPE_SECRET_KEY</code>{" "}
            al archivo <code className="font-mono">.env.local</code>: esta pantalla pasa
            automáticamente a Stripe Checkout y estos botones se desactivan.
          </p>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-800"
        >
          {error}
        </p>
      )}
    </div>
  );
}
