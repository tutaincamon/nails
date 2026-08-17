#!/usr/bin/env node
/*
 * Lanza los recordatorios del día antes llamando al endpoint del sitio.
 *
 * Para quien no despliegue en Vercel: añade esta línea al crontab del servidor
 * para que se ejecute todos los días a las 10:00.
 *
 *   0 10 * * *  cd /ruta/al/proyecto && npm run reminders >> /var/log/citas.log 2>&1
 *
 * Necesita NEXT_PUBLIC_SITE_URL y CRON_SECRET en el entorno (o en .env.local).
 */

import { readFileSync } from "node:fs";

function loadEnvFile(path) {
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key]) continue;
      process.env[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  } catch {
    // Sin .env.local no pasa nada: se usan las variables del entorno.
  }
}

loadEnvFile(new URL("../.env.local", import.meta.url).pathname);

const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const secret = process.env.CRON_SECRET;

if (!secret) {
  console.error(
    "Falta CRON_SECRET. Añádelo a .env.local (el mismo valor que use el sitio) y vuelve a ejecutar.",
  );
  process.exit(1);
}

const response = await fetch(`${base}/api/cron/reminders`, {
  method: "POST",
  headers: { Authorization: `Bearer ${secret}` },
});

const body = await response.json().catch(() => ({}));

if (!response.ok) {
  console.error(`Error ${response.status}:`, body.error ?? "respuesta inesperada");
  process.exit(1);
}

console.log(
  `Recordatorios del ${body.date}: ${body.sent?.length ?? 0} enviados de ${body.found ?? 0} citas.`,
);
