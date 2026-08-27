"use client";

import { useEffect, useState } from "react";

/*
 * Puerta de entrada al paso de datos: primero el email, y un código para
 * comprobar que ese buzón es suyo. Después ya se sabe si es nueva o repite.
 *
 * Se verifica SIEMPRE, también a quien reserva por primera vez. Dos motivos:
 *
 *   · De ese email cuelga todo lo demás: la confirmación, el enlace para
 *     cancelar y el aviso de un posible cargo. Una errata al teclearlo deja a
 *     la clienta sin nada de eso y a la profesional con una cita fantasma.
 *   · Como todo el mundo recibe código, desde fuera no hay forma de distinguir
 *     un email que es clienta de uno que no lo es.
 */

export type DatosRecuperados = { name: string; phone: string; address: string };

/*
 * Lo único que se guarda en el navegador es este testigo firmado: no lleva su
 * nombre, ni su teléfono, ni su dirección. Sirve para que el servidor
 * reconozca el dispositivo durante 30 días y no le pida el código otra vez.
 * Sus datos se piden al servidor cada vez, y solo si el testigo vale.
 */
const RECUERDO = "studio:dispositivo";

function leerRecuerdoLocal(): string | null {
  try {
    return window.localStorage.getItem(RECUERDO);
  } catch {
    return null;
  }
}

function guardarRecuerdoLocal(valor: string): void {
  try {
    window.localStorage.setItem(RECUERDO, valor);
  } catch {
    /* Modo incógnito: se le pedirá el código la próxima vez, sin más. */
  }
}

export function olvidarRecuerdoLocal(): void {
  try {
    window.localStorage.removeItem(RECUERDO);
  } catch {
    /* nada que hacer */
  }
}

export function VerificarEmail({
  onVerificado,
}: {
  onVerificado: (email: string, pase: string, datos: DatosRecuperados | null) => void;
}) {
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [fase, setFase] = useState<"comprobando" | "email" | "codigo">("comprobando");
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  /*
   * Al entrar se prueba el testigo del dispositivo. Si vale, se salta el
   * código; si no —caducado, otro móvil, o borrado— se pide como siempre.
   */
  useEffect(() => {
    const guardado = leerRecuerdoLocal();
    if (!guardado) {
      setFase("email");
      return;
    }
    let cancelado = false;
    (async () => {
      try {
        const r = await fetch("/api/verificar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recuerdo: guardado }),
        });
        const d = (await r.json()) as {
          ok: boolean;
          email?: string;
          pase?: string;
          datos?: DatosRecuperados | null;
        };
        if (cancelado) return;
        if (d.ok && d.email && d.pase) {
          onVerificado(d.email, d.pase, d.datos ?? null);
          return;
        }
        olvidarRecuerdoLocal();
        setFase("email");
      } catch {
        if (!cancelado) setFase("email");
      }
    })();
    return () => {
      cancelado = true;
    };
    // Solo al montar: reintentarlo en cada render sería una llamada por tecla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const d = (await r.json()) as {
        ok: boolean;
        error?: string;
        pase?: string;
        recuerdo?: string;
        datos?: DatosRecuperados | null;
      };
      if (!d.ok || !d.pase) {
        setError(d.error ?? "No se pudo comprobar el código.");
        return;
      }
      // Reconocido ya este dispositivo durante 30 días.
      if (d.recuerdo) guardarRecuerdoLocal(d.recuerdo);
      onVerificado(email.trim().toLowerCase(), d.pase, d.datos ?? null);
    } catch {
      setError("Problema de conexión. Inténtalo otra vez.");
    } finally {
      setTrabajando(false);
    }
  }

  if (fase === "comprobando") {
    return (
      <div className="animate-rise mt-8">
        <div className="h-8 w-52 animate-pulse bg-line/60" />
        <div className="mt-4 h-24 max-w-sm animate-pulse bg-line/40" />
      </div>
    );
  }

  return (
    <div className="animate-rise mt-8">
      <h2 className="text-[26px]">{fase === "email" ? "¿Cuál es tu email?" : "Mira tu correo"}</h2>

      {fase === "email" ? (
        <>
          <p className="mt-1.5 max-w-md text-[14px] leading-relaxed text-muted">
            Te mando un código para comprobar que es tuyo. Ahí te llegará la confirmación de la
            cita y el enlace para cancelarla, así que conviene que no tenga erratas.
          </p>

          <div className="mt-6 max-w-sm">
            <label className="label" htmlFor="verif-email">
              Email
            </label>
            <input
              id="verif-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              className="field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && email.includes("@")) void pedirCodigo();
              }}
              placeholder="lucia@email.com"
            />
            <button
              type="button"
              className="btn-primary mt-4 w-full"
              disabled={trabajando || !email.includes("@")}
              onClick={pedirCodigo}
            >
              {trabajando ? "Enviando…" : "Enviarme el código"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1.5 max-w-md text-[14px] leading-relaxed text-muted">
            He enviado un código de 6 cifras a <strong className="text-ink">{email}</strong>.
            Caduca en 10 minutos. Si no lo ves, mira en spam.
          </p>

          <div className="mt-6 max-w-sm">
            <label className="label" htmlFor="verif-codigo">
              Código
            </label>
            <input
              id="verif-codigo"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="field text-center font-mono text-[26px] tracking-[0.35em]"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && codigo.length === 6) void comprobar();
              }}
              placeholder="000000"
            />
            <button
              type="button"
              className="btn-primary mt-4 w-full"
              disabled={trabajando || codigo.length !== 6}
              onClick={comprobar}
            >
              {trabajando ? "Comprobando…" : "Continuar"}
            </button>
            <button
              type="button"
              className="btn-ghost btn-sm mt-2 w-full"
              disabled={trabajando}
              onClick={() => {
                setFase("email");
                setCodigo("");
                setError(null);
              }}
            >
              Me he equivocado de email
            </button>
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="mt-4 max-w-sm text-[13.5px] text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
