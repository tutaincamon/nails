"use client";

import { useState } from "react";

/** Formulario que pide el enlace a "Mis citas" por email. */
export function PedirEnlace() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/mis-citas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const datos = (await respuesta.json()) as { ok: boolean; error?: string };
      if (!datos.ok) {
        setError(datos.error ?? "No se pudo enviar el enlace.");
        return;
      }
      setEnviado(true);
    } catch {
      setError("Problema de conexión. Inténtalo otra vez.");
    } finally {
      setEnviando(false);
    }
  }

  /*
   * El mensaje es el mismo exista el email o no: el servidor tampoco distingue,
   * a propósito, para que nadie pueda averiguar quién es clienta probando
   * direcciones.
   */
  if (enviado) {
    return (
      <div className="border border-line bg-surface p-6">
        <p className="text-[16px] font-semibold text-ink">Mira tu correo</p>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          Si hay citas asociadas a <strong className="text-ink">{email}</strong>, acabas de recibir
          un enlace para verlas. Caduca en 72 horas.
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          ¿No te llega? Mira en spam, y comprueba que sea el mismo email con el que reservaste.
        </p>
        <button
          type="button"
          className="btn-ghost btn-sm mt-4"
          onClick={() => {
            setEnviado(false);
            setError(null);
          }}
        >
          Probar con otro email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="border border-line bg-surface p-6">
      <label className="label" htmlFor="portal-email">
        Tu email
      </label>
      <input
        id="portal-email"
        type="email"
        required
        inputMode="email"
        autoComplete="email"
        className="field"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="lucia@email.com"
      />
      {error && (
        <p role="alert" className="mt-3 text-[13px] text-red-700">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary mt-4 w-full" disabled={enviando}>
        {enviando ? "Enviando…" : "Enviarme el enlace"}
      </button>
    </form>
  );
}
