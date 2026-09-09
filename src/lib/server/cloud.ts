import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";

/**
 * Vercel's Neon integration injects one of these. When none is present the app
 * still runs — it just keeps everything on the device, as it did before the
 * database existed.
 */
const connectionString =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.NEON_DATABASE_URL ??
  "";

export const cloudEnabled = connectionString.length > 0;

type Row = Record<string, unknown>;
type Query = (text: string, params?: unknown[]) => Promise<Row[]>;

/**
 * Neon is reached over HTTP — no TCP handshake per invocation, which is what
 * you want from a serverless function. Any other Postgres (a local one, or a
 * self-hosted server) goes through a normal pooled connection.
 */
function makeQuery(): Query {
  if (/\.neon\.tech(:|\/|$)/.test(connectionString)) {
    const sql = neon(connectionString);
    return async (text, params = []) =>
      (await sql.query(text, params)) as Row[];
  }

  const pool = new Pool({
    connectionString,
    max: 3,
    ssl: /\bsslmode=(require|verify)/.test(connectionString)
      ? { rejectUnauthorized: false }
      : undefined,
  });
  return async (text, params = []) => (await pool.query(text, params)).rows as Row[];
}

let cachedQuery: Query | null = null;
function db(): Query {
  if (!cloudEnabled) throw new Error("Cloud storage is not configured.");
  return (cachedQuery ??= makeQuery());
}

/**
 * One row per record, with the shape kept in JSON.
 *
 * The server never filters on fields inside a record — every report and search
 * runs on the client against its local copy — so columns would buy nothing and
 * cost a migration each time the app gains a field. What the server does need
 * is per-row change tracking, and that is what these columns give: sync pulls
 * only what changed, and writes stay small even when the shop has years of
 * bills.
 */
const SCHEMA = [
  `create table if not exists records (
     kind       text        not null,
     id         text        not null,
     data       jsonb       not null,
     updated_at timestamptz not null default now(),
     deleted    boolean     not null default false,
     primary key (kind, id)
   )`,
  `create index if not exists records_updated_at_idx on records (updated_at)`,
];

let schemaReady: Promise<void> | null = null;

function ensureSchema() {
  // Runs once per warm instance; the statements are idempotent.
  schemaReady ??= (async () => {
    const query = db();
    for (const statement of SCHEMA) await query(statement);
  })().catch((err) => {
    schemaReady = null;
    throw err;
  });
  return schemaReady;
}

export interface RecordRow {
  kind: string;
  id: string;
  data: unknown;
  updatedAt: string;
  deleted: boolean;
}

const iso = (value: unknown) => new Date(value as string).toISOString();

/** Everything changed since `since`, oldest first. */
export async function pullSince(
  since: string | null,
  limit = 5000,
): Promise<{ rows: RecordRow[]; cursor: string; hasMore: boolean }> {
  await ensureSchema();
  const query = db();

  const raw = await query(
    `select kind, id, data, updated_at, deleted
       from records
      where updated_at > coalesce($1::timestamptz, 'epoch'::timestamptz)
      order by updated_at asc
      limit $2`,
    [since, limit + 1],
  );

  const hasMore = raw.length > limit;
  const page = hasMore ? raw.slice(0, limit) : raw;
  const rows: RecordRow[] = page.map((r) => ({
    kind: String(r.kind),
    id: String(r.id),
    data: r.data,
    updatedAt: iso(r.updated_at),
    deleted: Boolean(r.deleted),
  }));

  const last = rows[rows.length - 1];
  return {
    // Resume from the last row actually sent, so nothing is skipped.
    cursor: hasMore && last ? last.updatedAt : await serverNow(),
    rows,
    hasMore,
  };
}

export async function serverNow(): Promise<string> {
  await ensureSchema();
  const [row] = await db()(`select now() as now`);
  return iso(row!.now);
}

export interface PushRecord {
  kind: string;
  id: string;
  data?: unknown;
  deleted?: boolean;
}

/**
 * Upserts records, stamping server time so two devices whose clocks disagree
 * can't lose each other's writes.
 */
export async function pushRecords(records: PushRecord[]) {
  await ensureSchema();
  if (!records.length) return;

  await db()(
    `insert into records (kind, id, data, deleted, updated_at)
     select kind, id, data, deleted, now()
       from unnest($1::text[], $2::text[], $3::jsonb[], $4::boolean[])
            as t(kind, id, data, deleted)
     on conflict (kind, id) do update
        set data = excluded.data,
            deleted = excluded.deleted,
            updated_at = now()`,
    [
      records.map((r) => r.kind),
      records.map((r) => r.id),
      records.map((r) => JSON.stringify(r.data ?? {})),
      records.map((r) => Boolean(r.deleted)),
    ],
  );
}

export async function countRecords() {
  await ensureSchema();
  const [row] = await db()(
    `select count(*) filter (where not deleted) as live from records`,
  );
  return Number(row?.live ?? 0);
}
