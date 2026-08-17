import { mkdirSync } from "node:fs";
import path from "node:path";

/*
 * Capa de datos. Es el ÚNICO archivo que habla con la base de datos.
 *
 * Funciona con dos motores, elegidos según las variables de entorno:
 *
 *   LOCAL      Archivo SQLite en data/studio.db, con el módulo `node:sqlite`
 *              que ya viene en Node. Cero dependencias, cero configuración.
 *
 *   REMOTO     Turso (SQLite en la nube) por HTTP, cuando existe
 *              TURSO_DATABASE_URL. Es lo que permite desplegar en Vercel y
 *              similares, donde el disco es efímero y un archivo se perdería
 *              en cada despliegue.
 *
 * El SQL es el mismo en ambos casos: Turso ES SQLite.
 */

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "studio.db");

export type BookingStatus = "pending_payment" | "confirmed" | "cancelled" | "completed";
export type DepositStatus = "none" | "pending" | "paid" | "on_site";

export type BookingRow = {
  code: string;
  created_at: string;
  status: BookingStatus;
  service_id: string;
  service_name: string;
  category_name: string;
  addons_json: string;
  price_cents: number;
  price_from: number;
  duration_min: number;
  date: string;
  start_time: string;
  end_time: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  notes: string;
  deposit_cents: number;
  deposit_status: DepositStatus;
  payment_ref: string | null;
  manage_token: string;
  reminder_sent_at: string | null;
  cancelled_at: string | null;
};

export type BlockRow = {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  reason: string;
};

export type EmailRow = {
  id: number;
  created_at: string;
  to_addr: string;
  subject: string;
  kind: string;
  html: string;
  text: string;
  transport: string;
  booking_code: string | null;
  error: string | null;
};

type Value = string | number | null;
type Row = Record<string, unknown>;

/** Interfaz mínima que cumplen los dos motores. */
type Driver = {
  kind: "local" | "turso";
  all(sql: string, params?: Value[]): Promise<Row[]>;
  get(sql: string, params?: Value[]): Promise<Row | null>;
  run(sql: string, params?: Value[]): Promise<void>;
  script(sql: string): Promise<void>;
};

export function isRemoteDatabase(): boolean {
  return Boolean(process.env.TURSO_DATABASE_URL);
}

/* -------------------------------------------------------------------------- */
/*  Motor local: archivo SQLite con node:sqlite                               */
/* -------------------------------------------------------------------------- */
async function createLocalDriver(): Promise<Driver> {
  const { DatabaseSync } = await import("node:sqlite");

  mkdirSync(DATA_DIR, { recursive: true });
  const conn = new DatabaseSync(DB_PATH);
  conn.exec("PRAGMA journal_mode = WAL");
  conn.exec("PRAGMA foreign_keys = ON");

  // node:sqlite devuelve filas con prototipo nulo y React no las acepta al
  // pasarlas a componentes de cliente, así que se copian a objetos normales.
  const plain = (row: unknown): Row => ({ ...(row as object) });

  return {
    kind: "local",
    async all(sql, params = []) {
      return conn.prepare(sql).all(...params).map(plain);
    },
    async get(sql, params = []) {
      const row = conn.prepare(sql).get(...params);
      return row ? plain(row) : null;
    },
    async run(sql, params = []) {
      conn.prepare(sql).run(...params);
    },
    async script(sql) {
      conn.exec(sql);
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Motor remoto: Turso por HTTP                                              */
/* -------------------------------------------------------------------------- */
async function createTursoDriver(): Promise<Driver> {
  // La variante /web habla HTTP y no tiene dependencias nativas, que es
  // justo lo que necesita un entorno serverless.
  const { createClient } = await import("@libsql/client/web");

  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const toRows = (result: { columns: string[]; rows: unknown[] }): Row[] =>
    result.rows.map((raw) => {
      const row: Row = {};
      const values = raw as unknown as Record<number, unknown>;
      result.columns.forEach((column, index) => {
        row[column] = values[index];
      });
      return row;
    });

  return {
    kind: "turso",
    async all(sql, params = []) {
      return toRows(await client.execute({ sql, args: params }));
    },
    async get(sql, params = []) {
      const rows = toRows(await client.execute({ sql, args: params }));
      return rows[0] ?? null;
    },
    async run(sql, params = []) {
      await client.execute({ sql, args: params });
    },
    async script(sql) {
      await client.executeMultiple(sql);
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Conexión única                                                            */
/* -------------------------------------------------------------------------- */

/**
 * La conexión (y la migración) se hacen una sola vez por proceso. Se guarda la
 * promesa en globalThis porque Next recarga los módulos en caliente durante el
 * desarrollo y si no se abriría una conexión por recarga.
 */
function driver(): Promise<Driver> {
  const g = globalThis as typeof globalThis & { __studioDriver?: Promise<Driver> };
  if (g.__studioDriver) return g.__studioDriver;

  g.__studioDriver = (async () => {
    const instance = isRemoteDatabase() ? await createTursoDriver() : await createLocalDriver();
    await migrate(instance);
    console.info(
      `[bbdd] Motor ${instance.kind === "turso" ? "Turso (remoto)" : `archivo local (${DB_PATH})`}`,
    );
    return instance;
  })();

  // Si falla la conexión, no se cachea el error: el siguiente intento reintenta.
  g.__studioDriver.catch(() => {
    delete g.__studioDriver;
  });

  return g.__studioDriver;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS bookings (
    code             TEXT PRIMARY KEY,
    created_at       TEXT NOT NULL,
    status           TEXT NOT NULL,
    service_id       TEXT NOT NULL,
    service_name     TEXT NOT NULL,
    category_name    TEXT NOT NULL,
    addons_json      TEXT NOT NULL DEFAULT '[]',
    price_cents      INTEGER NOT NULL,
    price_from       INTEGER NOT NULL DEFAULT 0,
    duration_min     INTEGER NOT NULL,
    date             TEXT NOT NULL,
    start_time       TEXT NOT NULL,
    end_time         TEXT NOT NULL,
    client_name      TEXT NOT NULL,
    client_email     TEXT NOT NULL,
    client_phone     TEXT NOT NULL,
    notes            TEXT NOT NULL DEFAULT '',
    deposit_cents    INTEGER NOT NULL DEFAULT 0,
    deposit_status   TEXT NOT NULL DEFAULT 'none',
    payment_ref      TEXT,
    manage_token     TEXT NOT NULL,
    reminder_sent_at TEXT,
    cancelled_at     TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings (date, status);

  CREATE TABLE IF NOT EXISTS blocks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    date       TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time   TEXT NOT NULL,
    reason     TEXT NOT NULL DEFAULT ''
  );

  CREATE INDEX IF NOT EXISTS idx_blocks_date ON blocks (date);

  CREATE TABLE IF NOT EXISTS emails (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at   TEXT NOT NULL,
    to_addr      TEXT NOT NULL,
    subject      TEXT NOT NULL,
    kind         TEXT NOT NULL,
    html         TEXT NOT NULL,
    text         TEXT NOT NULL DEFAULT '',
    transport    TEXT NOT NULL,
    booking_code TEXT,
    error        TEXT
  );
`;

async function migrate(instance: Driver) {
  await instance.script(SCHEMA);
}

/* -------------------------------------------------------------------------- */
/*  Consultas                                                                 */
/* -------------------------------------------------------------------------- */

/** Estados que ocupan sitio en la agenda. */
const ACTIVE = "('pending_payment','confirmed','completed')";

export async function bookingsOn(date: string): Promise<BookingRow[]> {
  const db = await driver();
  return (await db.all(
    `SELECT * FROM bookings WHERE date = ? AND status IN ${ACTIVE} ORDER BY start_time`,
    [date],
  )) as BookingRow[];
}

export async function bookingsBetween(from: string, to: string): Promise<BookingRow[]> {
  const db = await driver();
  return (await db.all(
    `SELECT * FROM bookings WHERE date >= ? AND date <= ? AND status IN ${ACTIVE}
     ORDER BY date, start_time`,
    [from, to],
  )) as BookingRow[];
}

export async function blocksOn(date: string): Promise<BlockRow[]> {
  const db = await driver();
  return (await db.all("SELECT * FROM blocks WHERE date = ? ORDER BY start_time", [
    date,
  ])) as BlockRow[];
}

export async function blocksBetween(from: string, to: string): Promise<BlockRow[]> {
  const db = await driver();
  return (await db.all(
    "SELECT * FROM blocks WHERE date >= ? AND date <= ? ORDER BY date, start_time",
    [from, to],
  )) as BlockRow[];
}

export async function getBooking(code: string): Promise<BookingRow | null> {
  const db = await driver();
  return (await db.get("SELECT * FROM bookings WHERE code = ?", [code])) as BookingRow | null;
}

export async function insertBooking(
  row: Omit<BookingRow, "reminder_sent_at" | "cancelled_at">,
): Promise<void> {
  const db = await driver();
  await db.run(
    `INSERT INTO bookings (
      code, created_at, status, service_id, service_name, category_name, addons_json,
      price_cents, price_from, duration_min, date, start_time, end_time,
      client_name, client_email, client_phone, notes,
      deposit_cents, deposit_status, payment_ref, manage_token
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      row.code,
      row.created_at,
      row.status,
      row.service_id,
      row.service_name,
      row.category_name,
      row.addons_json,
      row.price_cents,
      row.price_from,
      row.duration_min,
      row.date,
      row.start_time,
      row.end_time,
      row.client_name,
      row.client_email,
      row.client_phone,
      row.notes,
      row.deposit_cents,
      row.deposit_status,
      row.payment_ref,
      row.manage_token,
    ],
  );
}

export async function updateBookingStatus(code: string, status: BookingStatus): Promise<void> {
  const db = await driver();
  const cancelledAt = status === "cancelled" ? new Date().toISOString() : null;
  await db.run("UPDATE bookings SET status = ?, cancelled_at = ? WHERE code = ?", [
    status,
    cancelledAt,
    code,
  ]);
}

export async function markDepositPaid(code: string, ref: string): Promise<void> {
  const db = await driver();
  await db.run(
    `UPDATE bookings SET deposit_status = 'paid', payment_ref = ?, status = 'confirmed'
     WHERE code = ?`,
    [ref, code],
  );
}

export async function markReminderSent(code: string): Promise<void> {
  const db = await driver();
  await db.run("UPDATE bookings SET reminder_sent_at = ? WHERE code = ?", [
    new Date().toISOString(),
    code,
  ]);
}

/** Reservas de un día concreto a las que aún no se ha enviado el recordatorio. */
export async function bookingsNeedingReminder(date: string): Promise<BookingRow[]> {
  const db = await driver();
  return (await db.all(
    `SELECT * FROM bookings
     WHERE date = ? AND status IN ('pending_payment','confirmed') AND reminder_sent_at IS NULL
     ORDER BY start_time`,
    [date],
  )) as BookingRow[];
}

export async function addBlock(
  date: string,
  startTime: string,
  endTime: string,
  reason: string,
): Promise<void> {
  const db = await driver();
  await db.run("INSERT INTO blocks (date, start_time, end_time, reason) VALUES (?,?,?,?)", [
    date,
    startTime,
    endTime,
    reason,
  ]);
}

export async function deleteBlock(id: number): Promise<void> {
  const db = await driver();
  await db.run("DELETE FROM blocks WHERE id = ?", [id]);
}

export async function logEmail(row: Omit<EmailRow, "id" | "created_at">): Promise<void> {
  const db = await driver();
  await db.run(
    `INSERT INTO emails (created_at, to_addr, subject, kind, html, text, transport, booking_code, error)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      new Date().toISOString(),
      row.to_addr,
      row.subject,
      row.kind,
      row.html,
      row.text,
      row.transport,
      row.booking_code,
      row.error,
    ],
  );
}

export async function recentEmails(limit = 40): Promise<EmailRow[]> {
  const db = await driver();
  return (await db.all("SELECT * FROM emails ORDER BY id DESC LIMIT ?", [limit])) as EmailRow[];
}

export async function getEmail(id: number): Promise<EmailRow | null> {
  const db = await driver();
  return (await db.get("SELECT * FROM emails WHERE id = ?", [id])) as EmailRow | null;
}

/** Todas las reservas para el panel, de la más reciente a la más antigua. */
export async function allBookings(limit = 200): Promise<BookingRow[]> {
  const db = await driver();
  return (await db.all("SELECT * FROM bookings ORDER BY date DESC, start_time DESC LIMIT ?", [
    limit,
  ])) as BookingRow[];
}
