import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

/*
 * Base de datos en un único archivo, con el módulo `node:sqlite` que viene
 * incluido en Node. Sin dependencias externas y sin nada que compilar.
 *
 * Para producción con varias instancias (Vercel, etc.) cambia solo este
 * archivo por Postgres o Turso: el resto de la app únicamente usa las
 * funciones exportadas más abajo.
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

let instance: DatabaseSync | null = null;

/**
 * Conexión única. En desarrollo Next recarga los módulos en caliente, así que
 * se guarda en globalThis para no abrir un descriptor de archivo por recarga.
 */
export function db(): DatabaseSync {
  const g = globalThis as typeof globalThis & { __studioDb?: DatabaseSync };
  if (g.__studioDb) return g.__studioDb;
  if (instance) return instance;

  mkdirSync(DATA_DIR, { recursive: true });
  const conn = new DatabaseSync(DB_PATH);
  conn.exec("PRAGMA journal_mode = WAL");
  conn.exec("PRAGMA foreign_keys = ON");
  migrate(conn);

  instance = conn;
  g.__studioDb = conn;
  return conn;
}

function migrate(conn: DatabaseSync) {
  conn.exec(`
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
  `);
}

/* -------------------------------------------------------------------------- */
/*  Consultas                                                                 */
/* -------------------------------------------------------------------------- */

/** Estados que ocupan sitio en la agenda. */
const ACTIVE = "('pending_payment','confirmed','completed')";

/*
 * node:sqlite devuelve las filas como objetos con prototipo nulo. React no los
 * considera "objetos planos" y se niega a pasarlos de un componente de servidor
 * a uno de cliente, así que todas las consultas los copian a objetos normales.
 */
function rows<T>(result: unknown[]): T[] {
  return result.map((row) => ({ ...(row as object) }) as T);
}

function firstRow<T>(result: unknown): T | null {
  return result ? ({ ...(result as object) } as T) : null;
}

export function bookingsOn(date: string): BookingRow[] {
  return rows<BookingRow>(
    db()
      .prepare(`SELECT * FROM bookings WHERE date = ? AND status IN ${ACTIVE} ORDER BY start_time`)
      .all(date),
  );
}

export function bookingsBetween(from: string, to: string): BookingRow[] {
  return rows<BookingRow>(
    db()
      .prepare(
        `SELECT * FROM bookings WHERE date >= ? AND date <= ? AND status IN ${ACTIVE}
         ORDER BY date, start_time`,
      )
      .all(from, to),
  );
}

export function blocksOn(date: string): BlockRow[] {
  return rows<BlockRow>(
    db().prepare("SELECT * FROM blocks WHERE date = ? ORDER BY start_time").all(date),
  );
}

export function blocksBetween(from: string, to: string): BlockRow[] {
  return rows<BlockRow>(
    db()
      .prepare("SELECT * FROM blocks WHERE date >= ? AND date <= ? ORDER BY date, start_time")
      .all(from, to),
  );
}

export function getBooking(code: string): BookingRow | null {
  return firstRow<BookingRow>(db().prepare("SELECT * FROM bookings WHERE code = ?").get(code));
}

export function insertBooking(row: Omit<BookingRow, "reminder_sent_at" | "cancelled_at">) {
  db()
    .prepare(
      `INSERT INTO bookings (
        code, created_at, status, service_id, service_name, category_name, addons_json,
        price_cents, price_from, duration_min, date, start_time, end_time,
        client_name, client_email, client_phone, notes,
        deposit_cents, deposit_status, payment_ref, manage_token
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
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
    );
}

export function updateBookingStatus(code: string, status: BookingStatus) {
  const cancelledAt = status === "cancelled" ? new Date().toISOString() : null;
  db()
    .prepare("UPDATE bookings SET status = ?, cancelled_at = ? WHERE code = ?")
    .run(status, cancelledAt, code);
}

export function markDepositPaid(code: string, ref: string) {
  db()
    .prepare(
      `UPDATE bookings SET deposit_status = 'paid', payment_ref = ?, status = 'confirmed'
       WHERE code = ?`,
    )
    .run(ref, code);
}

export function markReminderSent(code: string) {
  db()
    .prepare("UPDATE bookings SET reminder_sent_at = ? WHERE code = ?")
    .run(new Date().toISOString(), code);
}

/** Reservas confirmadas de un día concreto a las que aún no se ha avisado. */
export function bookingsNeedingReminder(date: string): BookingRow[] {
  return rows<BookingRow>(
    db()
      .prepare(
        `SELECT * FROM bookings
         WHERE date = ? AND status IN ('pending_payment','confirmed') AND reminder_sent_at IS NULL
         ORDER BY start_time`,
      )
      .all(date),
  );
}

export function addBlock(date: string, startTime: string, endTime: string, reason: string) {
  db()
    .prepare("INSERT INTO blocks (date, start_time, end_time, reason) VALUES (?,?,?,?)")
    .run(date, startTime, endTime, reason);
}

export function deleteBlock(id: number) {
  db().prepare("DELETE FROM blocks WHERE id = ?").run(id);
}

export function logEmail(row: Omit<EmailRow, "id" | "created_at">) {
  db()
    .prepare(
      `INSERT INTO emails (created_at, to_addr, subject, kind, html, text, transport, booking_code, error)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      new Date().toISOString(),
      row.to_addr,
      row.subject,
      row.kind,
      row.html,
      row.text,
      row.transport,
      row.booking_code,
      row.error,
    );
}

export function recentEmails(limit = 40): EmailRow[] {
  return rows<EmailRow>(
    db().prepare("SELECT * FROM emails ORDER BY id DESC LIMIT ?").all(limit),
  );
}

export function getEmail(id: number): EmailRow | null {
  return firstRow<EmailRow>(db().prepare("SELECT * FROM emails WHERE id = ?").get(id));
}

/** Todas las reservas para el panel, de la más reciente a la más antigua. */
export function allBookings(limit = 200): BookingRow[] {
  return rows<BookingRow>(
    db().prepare("SELECT * FROM bookings ORDER BY date DESC, start_time DESC LIMIT ?").all(limit),
  );
}
