import { mkdirSync } from "node:fs";
import path from "node:path";
import { env } from "@/lib/env";

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

const DATA_DIR = env("DATA_DIR") ?? path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "studio.db");

export type BookingStatus = "pending_payment" | "confirmed" | "cancelled" | "completed";
export type DepositStatus = "none" | "pending" | "paid" | "on_site";

/*
 * Quién canceló la cita. Importa porque decide si se le puede cobrar: una cita
 * que canceló la profesional no se cobra nunca, por tarde que sea.
 *
 * La cadena vacía es "no consta": citas que nadie canceló (un plantón, sin ir
 * más lejos) y las que se cancelaron antes de que existiera esta columna. No
 * se trata como "la canceló ella" a propósito, porque entonces ningún plantón
 * sería cobrable.
 */
export type CancelledBy = "" | "client" | "admin";

export type BookingRow = {
  code: string;
  created_at: string;
  status: BookingStatus;
  /* Primer servicio de la cita. Se conserva por comodidad al filtrar. */
  service_id: string;
  /** Todos los servicios juntos: "Semipermanente + Pedicura básica". */
  service_name: string;
  category_name: string;
  /*
   * Los servicios de la cita, uno a uno, con lo que costaba cada uno el día en
   * que se reservó: [{ id, name, price, durationMin, categoryName }].
   *
   * Se guarda la lista y no solo el nombre junto porque una cita puede ser
   * varios servicios, y las estadísticas necesitan repartir el importe entre
   * ellos para saber qué es lo que de verdad se pide.
   *
   * Vacío en las reservas anteriores a que esto existiera: ahí manda
   * service_name. Ver serviciosDe() en src/lib/servicios.ts.
   */
  services_json: string;
  /** Extras elegidos: [{ name, price, units }], con price por unidad. */
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
  /** Dónde vive la clienta. Solo se pide cuando la profesional va a su casa. */
  client_address: string;
  notes: string;
  deposit_cents: number;
  deposit_status: DepositStatus;
  payment_ref: string | null;
  manage_token: string;
  reminder_sent_at: string | null;
  cancelled_at: string | null;
  cancelled_by: CancelledBy;

  /* --- Tarjeta guardada para cobrar plantones -------------------------- */
  /*
   * Aquí NO hay ningún dato de tarjeta. Son referencias de Stripe: sirven para
   * cobrar en esa cuenta de Stripe y no valen para nada fuera de ella. El
   * número lo pide y lo guarda Stripe, nunca este servidor.
   */
  stripe_customer_id: string;
  card_payment_method: string;
  /** Para que ella vea de qué tarjeta habla: "visa ···· 4242". */
  card_label: string;
  /** Cuándo aceptó la política de cancelación. Es la prueba para cobrar. */
  policy_accepted_at: string | null;
  /** Importe ya cobrado por no presentarse, si se ha llegado a cobrar. */
  no_show_cents: number;
  no_show_ref: string | null;

  /* --- Precio final, cuando el servicio ya está hecho ------------------ */
  /*
   * Lo que acabó costando de verdad, que puede no ser lo presupuestado: un
   * extra sobre la marcha, una reparación, un diseño que llevó el doble. Vale
   * 0 mientras nadie lo ajuste. Ver src/lib/price.ts.
   */
  final_price_cents: number;
  /** Por qué cambió: "2 uñas con gemas". Es lo que da sentido al número. */
  price_note: string;
  price_updated_at: string | null;
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
  return Boolean(env("TURSO_DATABASE_URL"));
}

/**
 * Turso entrega la URL como `libsql://…`, pero el cliente /web habla HTTP.
 * Se traduce aquí para aceptar la URL tal cual venga de Turso o de Vercel.
 */
export function tursoHttpUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith("libsql://")) return `https://${trimmed.slice("libsql://".length)}`;
  if (trimmed.startsWith("wss://")) return `https://${trimmed.slice("wss://".length)}`;
  if (trimmed.startsWith("ws://")) return `http://${trimmed.slice("ws://".length)}`;
  return trimmed;
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
    url: tursoHttpUrl(env("TURSO_DATABASE_URL")!),
    authToken: env("TURSO_AUTH_TOKEN"),
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
    services_json    TEXT NOT NULL DEFAULT '[]',
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
    client_address   TEXT NOT NULL DEFAULT '',
    notes            TEXT NOT NULL DEFAULT '',
    deposit_cents    INTEGER NOT NULL DEFAULT 0,
    deposit_status   TEXT NOT NULL DEFAULT 'none',
    payment_ref      TEXT,
    manage_token     TEXT NOT NULL,
    reminder_sent_at TEXT,
    cancelled_at     TEXT,
    cancelled_by     TEXT NOT NULL DEFAULT '',
    stripe_customer_id  TEXT NOT NULL DEFAULT '',
    card_payment_method TEXT NOT NULL DEFAULT '',
    card_label          TEXT NOT NULL DEFAULT '',
    policy_accepted_at  TEXT,
    no_show_cents       INTEGER NOT NULL DEFAULT 0,
    no_show_ref         TEXT,
    final_price_cents   INTEGER NOT NULL DEFAULT 0,
    price_note          TEXT NOT NULL DEFAULT '',
    price_updated_at    TEXT
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

  CREATE TABLE IF NOT EXISTS weekly_hours (
    weekday     INTEGER PRIMARY KEY,
    ranges_json TEXT NOT NULL
  );

  /*
   * Códigos de un solo uso para que una clienta que ya ha venido demuestre que
   * ese email es suyo y recupere sus datos sin escribirlos otra vez.
   *
   * Se guarda el HASH del código, nunca el código: si alguien llegara a leer
   * esta tabla, no podría usar lo que hay dentro para entrar en ninguna cuenta.
   */
  /*
   * Horario de un día concreto, cuando esa fecha no sigue el horario de
   * siempre. La semana que viene puede trabajar distinto que esta, y eso no
   * cabe en un horario semanal.
   *
   * Solo se guardan los días que ella toca: lo que no está aquí sigue el
   * horario semanal, así que no tiene que rellenar el calendario entero.
   */
  CREATE TABLE IF NOT EXISTS day_hours (
    date        TEXT PRIMARY KEY,
    ranges_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS verification_codes (
    email      TEXT PRIMARY KEY,
    code_hash  TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    attempts   INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
`;

/**
 * Columnas añadidas después de que hubiera bases de datos en producción.
 * CREATE TABLE IF NOT EXISTS no toca una tabla que ya existe, así que sin esto
 * un despliegue antiguo se quedaría sin la columna y fallaría al guardar.
 */
const ADDED_COLUMNS: { table: string; column: string; ddl: string }[] = [
  { table: "bookings", column: "client_address", ddl: "TEXT NOT NULL DEFAULT ''" },
  { table: "bookings", column: "stripe_customer_id", ddl: "TEXT NOT NULL DEFAULT ''" },
  { table: "bookings", column: "card_payment_method", ddl: "TEXT NOT NULL DEFAULT ''" },
  { table: "bookings", column: "card_label", ddl: "TEXT NOT NULL DEFAULT ''" },
  { table: "bookings", column: "policy_accepted_at", ddl: "TEXT" },
  { table: "bookings", column: "no_show_cents", ddl: "INTEGER NOT NULL DEFAULT 0" },
  { table: "bookings", column: "no_show_ref", ddl: "TEXT" },
  { table: "bookings", column: "final_price_cents", ddl: "INTEGER NOT NULL DEFAULT 0" },
  { table: "bookings", column: "price_note", ddl: "TEXT NOT NULL DEFAULT ''" },
  { table: "bookings", column: "price_updated_at", ddl: "TEXT" },
  { table: "bookings", column: "services_json", ddl: "TEXT NOT NULL DEFAULT '[]'" },
  { table: "bookings", column: "cancelled_by", ddl: "TEXT NOT NULL DEFAULT ''" },
];

async function migrate(instance: Driver) {
  await instance.script(SCHEMA);

  for (const { table, column, ddl } of ADDED_COLUMNS) {
    const columns = await instance.all(`PRAGMA table_info(${table})`);
    const exists = columns.some((row) => row.name === column);
    if (!exists) {
      await instance.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
      console.info(`[bbdd] Columna añadida: ${table}.${column}`);
    }
  }
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

/*
 * Los campos que no se piden aquí los pone la propia tabla con su valor por
 * defecto: se rellenan después (la tarjeta al pagar, el plantón al cobrarlo).
 */
export async function insertBooking(
  row: Omit<
    BookingRow,
    | "reminder_sent_at"
    | "cancelled_at"
    | "cancelled_by"
    | "stripe_customer_id"
    | "card_payment_method"
    | "card_label"
    | "policy_accepted_at"
    | "no_show_cents"
    | "no_show_ref"
    | "final_price_cents"
    | "price_note"
    | "price_updated_at"
  >,
): Promise<void> {
  const db = await driver();
  await db.run(
    `INSERT INTO bookings (
      code, created_at, status, service_id, service_name, category_name, services_json, addons_json,
      price_cents, price_from, duration_min, date, start_time, end_time,
      client_name, client_email, client_phone, client_address, notes,
      deposit_cents, deposit_status, payment_ref, manage_token
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      row.code,
      row.created_at,
      row.status,
      row.service_id,
      row.service_name,
      row.category_name,
      row.services_json,
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
      row.client_address,
      row.notes,
      row.deposit_cents,
      row.deposit_status,
      row.payment_ref,
      row.manage_token,
    ],
  );
}

/**
 * Cambios que la profesional hace desde el panel: mover la cita de hora o
 * corregir los datos de la clienta.
 *
 * El servicio y el precio NO se tocan aquí a propósito. Cambiarlos altera la
 * duración y con ella los huecos del resto del día, así que eso es cancelar y
 * volver a reservar, no editar.
 */
export async function updateBookingDetails(
  code: string,
  cambios: {
    date: string;
    start_time: string;
    end_time: string;
    client_name: string;
    client_phone: string;
    client_address: string;
    notes: string;
  },
): Promise<void> {
  const db = await driver();
  await db.run(
    `UPDATE bookings SET
       date = ?, start_time = ?, end_time = ?,
       client_name = ?, client_phone = ?, client_address = ?, notes = ?
     WHERE code = ?`,
    [
      cambios.date,
      cambios.start_time,
      cambios.end_time,
      cambios.client_name,
      cambios.client_phone,
      cambios.client_address,
      cambios.notes,
      code,
    ],
  );
}

/*
 * Cambiar el estado de una cita. Al cancelar hay que decir quién lo hizo, y no
 * es un dato administrativo: de ahí depende si luego se le puede cobrar.
 */
export async function updateBookingStatus(
  code: string,
  status: BookingStatus,
  cancelledBy: CancelledBy = "",
): Promise<void> {
  const db = await driver();
  const cancelando = status === "cancelled";
  await db.run("UPDATE bookings SET status = ?, cancelled_at = ?, cancelled_by = ? WHERE code = ?", [
    status,
    cancelando ? new Date().toISOString() : null,
    cancelando ? cancelledBy : "",
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

/**
 * Guarda las referencias de Stripe de la tarjeta que la clienta dejó al pagar
 * la señal. Solo identificadores: ningún dato de tarjeta llega hasta aquí.
 */
export async function saveCardOnFile(
  code: string,
  customerId: string,
  paymentMethodId: string,
  label: string,
): Promise<void> {
  const db = await driver();
  await db.run(
    `UPDATE bookings
     SET stripe_customer_id = ?, card_payment_method = ?, card_label = ?
     WHERE code = ?`,
    [customerId, paymentMethodId, label, code],
  );
}

/** Marca cuándo aceptó la política de cancelación. */
export async function markPolicyAccepted(code: string, when: string): Promise<void> {
  const db = await driver();
  await db.run("UPDATE bookings SET policy_accepted_at = ? WHERE code = ?", [when, code]);
}

/** Registra el cobro por no presentarse, para que no se cobre dos veces. */
export async function markNoShowCharged(
  code: string,
  cents: number,
  ref: string,
): Promise<void> {
  const db = await driver();
  await db.run("UPDATE bookings SET no_show_cents = ?, no_show_ref = ? WHERE code = ?", [
    cents,
    ref,
    code,
  ]);
}

/**
 * Ajusta lo que acabó costando una cita ya realizada.
 *
 * Se guarda aparte del precio de la reserva a propósito: ese hay que poder
 * releerlo tal cual lo aceptó la clienta. Aquí solo se añade lo que se supo
 * después.
 *
 * `cents = 0` deshace el ajuste y devuelve la cita a su precio de reserva.
 */
export async function setFinalPrice(
  code: string,
  cents: number,
  note: string,
): Promise<void> {
  const db = await driver();
  await db.run(
    "UPDATE bookings SET final_price_cents = ?, price_note = ?, price_updated_at = ? WHERE code = ?",
    [cents, note, cents > 0 ? new Date().toISOString() : null, code],
  );
}

/* -------------------------------------------------------------------------- */
/*  Datos de la clienta: quitar tarjeta y borrar cuenta                       */
/* -------------------------------------------------------------------------- */

/** Olvida las tarjetas guardadas de una clienta. Las citas se quedan. */
export async function forgetCardsForEmail(email: string): Promise<void> {
  const db = await driver();
  await db.run(
    `UPDATE bookings
     SET stripe_customer_id = '', card_payment_method = '', card_label = ''
     WHERE lower(client_email) = ?`,
    [email.trim().toLowerCase()],
  );
}

/**
 * Borra los datos personales de una clienta conservando la cita en sí.
 *
 * No se borran las filas: una cita atendida es una venta, y la ley obliga a
 * conservar el registro contable unos años. Lo que se borra es todo lo que
 * identifica a la persona —nombre, email, teléfono, dirección, notas y las
 * referencias de su tarjeta—, que es exactamente lo que protege el derecho de
 * supresión. Lo que queda (fecha, servicio, importe) ya no apunta a nadie.
 */
export async function anonymiseClient(email: string): Promise<number> {
  const db = await driver();
  const clave = email.trim().toLowerCase();

  const antes = (await db.all("SELECT code FROM bookings WHERE lower(client_email) = ?", [
    clave,
  ])) as { code: string }[];

  await db.run(
    `UPDATE bookings SET
       client_name = 'Clienta que pidió borrar sus datos',
       client_email = '',
       client_phone = '',
       client_address = '',
       notes = '',
       stripe_customer_id = '',
       card_payment_method = '',
       card_label = ''
     WHERE lower(client_email) = ?`,
    [clave],
  );

  // Los emails guardados también llevan su nombre y su dirección dentro.
  await db.run("DELETE FROM emails WHERE lower(to_addr) = ?", [clave]);
  await db.run("DELETE FROM verification_codes WHERE email = ?", [clave]);

  return antes.length;
}

/* -------------------------------------------------------------------------- */
/*  Códigos de verificación                                                   */
/* -------------------------------------------------------------------------- */

export type CodeRow = {
  email: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
  created_at: string;
};

/** Guarda el código de un email, sustituyendo el anterior si lo hubiera. */
export async function saveCode(
  email: string,
  codeHash: string,
  expiresAt: string,
): Promise<void> {
  const db = await driver();
  const clave = email.trim().toLowerCase();
  await db.run("DELETE FROM verification_codes WHERE email = ?", [clave]);
  await db.run(
    `INSERT INTO verification_codes (email, code_hash, expires_at, attempts, created_at)
     VALUES (?,?,?,0,?)`,
    [clave, codeHash, expiresAt, new Date().toISOString()],
  );
}

export async function getCode(email: string): Promise<CodeRow | null> {
  const db = await driver();
  return (await db.get("SELECT * FROM verification_codes WHERE email = ?", [
    email.trim().toLowerCase(),
  ])) as CodeRow | null;
}

/** Suma un intento fallido. A los 5, el código deja de servir. */
export async function bumpCodeAttempts(email: string): Promise<void> {
  const db = await driver();
  await db.run(
    "UPDATE verification_codes SET attempts = attempts + 1 WHERE email = ?",
    [email.trim().toLowerCase()],
  );
}

/** Un código usado se borra: solo vale una vez. */
export async function deleteCode(email: string): Promise<void> {
  const db = await driver();
  await db.run("DELETE FROM verification_codes WHERE email = ?", [
    email.trim().toLowerCase(),
  ]);
}

/* -------------------------------------------------------------------------- */
/*  Horario semanal                                                           */
/* -------------------------------------------------------------------------- */

/*
 * El horario vivía solo en el archivo de configuración, así que cambiarlo era
 * tocar código y volver a desplegar. Para quien no tiene horario fijo eso no
 * sirve: necesita cambiarlo desde el panel.
 *
 * La tabla manda cuando tiene filas; si está vacía, se usa el de la
 * configuración. Así los despliegues que ya funcionaban siguen igual y nadie
 * tiene que rellenar nada para que su web siga comportándose como antes.
 */

export type WeeklyHours = Record<number, { start: string; end: string }[]>;

/** Horario guardado en el panel, o null si nunca se ha tocado. */
export async function getWeeklyHours(): Promise<WeeklyHours | null> {
  const db = await driver();
  const rows = await db.all("SELECT weekday, ranges_json FROM weekly_hours");
  if (rows.length === 0) return null;

  const hours: WeeklyHours = {};
  for (let day = 0; day < 7; day++) hours[day] = [];

  for (const row of rows) {
    const day = Number(row.weekday);
    if (!Number.isInteger(day) || day < 0 || day > 6) continue;
    try {
      const parsed = JSON.parse(String(row.ranges_json));
      if (Array.isArray(parsed)) hours[day] = parsed;
    } catch {
      // Una fila corrupta deja ese día cerrado en vez de tumbar la agenda entera.
      console.error(`[bbdd] Horario ilegible para el día ${day}`);
    }
  }

  return hours;
}

/** Guarda los 7 días de una vez. Sustituye por completo lo que hubiera. */
export async function saveWeeklyHours(hours: WeeklyHours): Promise<void> {
  const db = await driver();
  await db.run("DELETE FROM weekly_hours");
  for (let day = 0; day < 7; day++) {
    await db.run("INSERT INTO weekly_hours (weekday, ranges_json) VALUES (?,?)", [
      day,
      JSON.stringify(hours[day] ?? []),
    ]);
  }
}

/** Vuelve al horario del archivo de configuración. */
export async function resetWeeklyHours(): Promise<void> {
  const db = await driver();
  await db.run("DELETE FROM weekly_hours");
}

/* -------------------------------------------------------------------------- */
/*  Horario de días concretos                                                 */
/* -------------------------------------------------------------------------- */

export type DiasSueltos = Record<string, { start: string; end: string }[]>;

/** Los días entre dos fechas que tienen horario propio. */
export async function getDayHours(desde: string, hasta: string): Promise<DiasSueltos> {
  const db = await driver();
  const filas = await db.all(
    "SELECT date, ranges_json FROM day_hours WHERE date >= ? AND date <= ?",
    [desde, hasta],
  );

  const dias: DiasSueltos = {};
  for (const fila of filas) {
    try {
      const tramos = JSON.parse(String(fila.ranges_json));
      if (Array.isArray(tramos)) dias[String(fila.date)] = tramos;
    } catch {
      console.error(`[bbdd] Horario ilegible del día ${fila.date}`);
    }
  }
  return dias;
}

/**
 * Fija el horario de un día concreto.
 *
 * Un array vacío NO es lo mismo que borrar: vacío significa "ese día no
 * trabajo", y borrar significa "ese día vuelve a seguir mi horario de
 * siempre". Confundirlos abriría un día que ella había cerrado a mano.
 */
export async function setDayHours(
  date: string,
  ranges: { start: string; end: string }[],
): Promise<void> {
  const db = await driver();
  await db.run("DELETE FROM day_hours WHERE date = ?", [date]);
  await db.run("INSERT INTO day_hours (date, ranges_json) VALUES (?,?)", [
    date,
    JSON.stringify(ranges),
  ]);
}

/** Devuelve ese día a su horario semanal. */
export async function clearDayHours(date: string): Promise<void> {
  const db = await driver();
  await db.run("DELETE FROM day_hours WHERE date = ?", [date]);
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

/**
 * Todas las citas de una clienta, de la más próxima a la más antigua.
 *
 * El email se compara en minúsculas porque se guarda así al reservar, pero la
 * clienta puede escribirlo de otra forma al pedir su listado.
 */
export async function bookingsForEmail(email: string, limit = 50): Promise<BookingRow[]> {
  const db = await driver();
  return (await db.all(
    `SELECT * FROM bookings WHERE lower(client_email) = ?
     ORDER BY date DESC, start_time DESC LIMIT ?`,
    [email.trim().toLowerCase(), limit],
  )) as BookingRow[];
}

/** Todas las reservas desde una fecha, en cualquier estado. Para estadísticas. */
export async function bookingsFrom(date: string): Promise<BookingRow[]> {
  const db = await driver();
  return (await db.all("SELECT * FROM bookings WHERE date >= ? ORDER BY date, start_time", [
    date,
  ])) as BookingRow[];
}
