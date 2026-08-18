"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import siteConfig from "@config";

export function AdminLogin({ showDefaultHint }: { showDefaultHint: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "No se pudo entrar.");
        return;
      }
      router.refresh();
    } catch {
      setError("Problema de conexión. Inténtalo otra vez.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="section max-w-sm py-20">
      <p className="eyebrow">{siteConfig.business.name}</p>
      <h1 className="mt-2 text-[2rem]">Agenda</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-muted">
        Acceso solo para la profesional. Aquí se ven las reservas, se bloquean huecos y se revisan los
        emails enviados.
      </p>

      <form onSubmit={submit} className="mt-7">
        <label className="label" htmlFor="password">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          className={`field ${error ? "field-error" : ""}`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />

        {error && (
          <p role="alert" className="mt-2 text-[13px] text-red-700">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary mt-4 w-full" disabled={working || !password}>
          {working ? "Entrando…" : "Entrar"}
        </button>
      </form>

      {showDefaultHint && (
        <p className="mt-6 border border-dashed border-line bg-surface px-4 py-3 text-[12.5px] leading-relaxed text-muted">
          <strong className="text-ink">Sin contraseña configurada.</strong> Se está usando la de
          ejemplo: <code className="font-mono font-semibold">demo1234</code>. Cámbiala poniendo{" "}
          <code className="font-mono">ADMIN_PASSWORD</code> en <code className="font-mono">.env.local</code>{" "}
          antes de publicar la web.
        </p>
      )}
    </div>
  );
}
