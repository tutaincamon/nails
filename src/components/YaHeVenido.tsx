"use client";

import { useState } from "react";

/*
 * "Ya he venido antes": recupera los datos de una clienta que repite sin que
 * los escriba otra vez, pero solo después de que demuestre que ese buzón es
 * suyo con un código.
 *
 * El código no es burocracia: sin él, teclear un email cualquiera devolvería el
 * nombre, el teléfono y la dirección de casa de esa persona.
 */

export type DatosRecuperados = { name: string; phone: string; address: string };

type Fase = "cerrado" | "email" | "codigo" | "listo";

export function YaHeVenido({
  email,
  onEmailChange,
  onRecuperado,
}: {
  email: string;
  onEmailChange: (valor: string) => void;
  onRecuperado: (datos: DatosRecuperados, email: string) => void;
}) {
  const [fase, setFase] = useState<Fase>("cerrado");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  async function pedirCodigo() {
    setTrabajando(true);
    setError(null);
    try {
      const r = await fetch("/api/verificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const d = (await r.json()) as { ok: boolean; error?: string };
      if (!d.ok) {
        setError(d.error ?? "No se pudo enviar el código.");
        return;
      }
      setFase("codigo");
    } catch {
      setError("Problema de conexión. Inténtalo otra vez.");
    } finally {
      setTrabajando(false);
    }
  }

  async function comprobar() {
    setTrabajando(true);
    setError(null);
    try {
      const r = await fetch("/api/verificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, codigo }),
      });
      const d = (await r.json()) as { ok: boolean; error?: string; datos?: DatosRecuperados };
      if (!d.ok || !d.datos) {
        setError(d.error ?? "No se pudo comprobar el código.");
        return;
      }
      onRecuperado(d.datos, email);
      setFase("listo");
    } catch {
      setError("Problema de conexión. Inténtalo otra vez.");
    } finally {
      setTrabajando(false);
    }
  }

  if (fase === "listo") {
    return (
      <p className="mb-6 border border-line bg-surface px-4 py-3 text-[13.5px] leading-relaxed text-ink">
        Listo, he recuperado tus datos. <strong>Revisa la dirección</strong> antes de seguir, por si
        has cambiado de casa.
      </p>
    );
  }

  if (fase === "cerrado") {
    return (
      <p className="mb-6 border border-line bg-surface px-4 py-3 text-[13.5px] leading-relaxed text-muted">
        ¿Ya has reservado conmigo?{" "}
        <button
          type="button"
          className="font-semibold text-primary underline underline-offset-2"
          onClick={() => setFase("email")}
        >
          Recupera tus datos
        </button>{" "}
        y no tendrás que escribirlo todo otra vez.
      </p>
    );
  }

  return (
    <div className="mb-6 border border-line bg-surface p-4">
      {fase === "email" ? (
        <>
          <label className="label" htmlFor="verif-email">
            Tu email de siempre
          </label>
          <input
            id="verif-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            className="field"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="lucia@email.com"
          />
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
            Te mando un código de 6 cifras para comprobar que es tuyo.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary btn-sm"
              disabled={trabajando || !email.includes("@")}
              onClick={pedirCodigo}
            >
              {trabajando ? "Enviando…" : "Enviarme el código"}
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setFase("cerrado")}>
              Mejor lo escribo
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[13.5px] leading-relaxed text-ink">
            Si tienes citas con <strong>{email}</strong>, acabas de recibir un código. Caduca en 10
            minutos.
          </p>
          <label className="label mt-3" htmlFor="verif-codigo">
            Código
          </label>
          <input
            id="verif-codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className="field font-mono text-[20px] tracking-[0.3em]"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary btn-sm"
              disabled={trabajando || codigo.length !== 6}
              onClick={comprobar}
            >
              {trabajando ? "Comprobando…" : "Continuar"}
            </button>
            <button
              type="button"
              className="btn-ghost btn-sm"
              disabled={trabajando}
              onClick={() => {
                setFase("email");
                setCodigo("");
                setError(null);
              }}
            >
              Cambiar el email
            </button>
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="mt-3 text-[13px] text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
