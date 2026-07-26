/**
 * Local data layer (offline-first).
 *
 * Replaces the dead Cloudflare D1 / GetMocha backend. Everything lives in
 * localStorage, seeded once from `public/seed/bisnisku-seed.json`.
 *
 * It exposes a tiny subset of the PostgREST/Supabase query-builder API so the
 * rest of the app (hooks, pages, modals) keeps working without changes:
 *
 *   db.from("orders").select("*").eq("id", 1).order("created_at").single()
 *   db.from("orders").insert({...}).select().single()
 *   db.from("orders").update({...}).eq("id", 1).select().single()
 *   db.from("orders").delete().eq("id", 1)
 */

export type Row = Record<string, any>;

export type TableName =
  | "store_settings"
  | "branches"
  | "products"
  | "orders"
  | "order_items"
  | "payment_records"
  | "expenses"
  | "payment_gateway_settings";

export const TABLES: TableName[] = [
  "store_settings",
  "branches",
  "products",
  "orders",
  "order_items",
  "payment_records",
  "expenses",
  "payment_gateway_settings",
];

type Database = Record<TableName, Row[]>;

const DB_KEY = "bisnisku:db:v1";
const FILES_KEY = "bisnisku:files:v1";
export const SEED_URL = "/seed/bisnisku-seed.json";

/** Rows deleted from a parent table also remove their children. */
const CASCADES: Partial<Record<TableName, Array<{ table: TableName; column: string }>>> = {
  orders: [
    { table: "order_items", column: "order_id" },
    { table: "payment_records", column: "order_id" },
  ],
};

/* -------------------------------------------------------------------------- */
/* Safe storage                                                                */
/* -------------------------------------------------------------------------- */

const memoryStore = new Map<string, string>();

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memoryStore.get(key) ?? null;
  }
}

function safeSet(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    // Quota exceeded or storage disabled - keep working in memory.
    memoryStore.set(key, value);
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Database state                                                              */
/* -------------------------------------------------------------------------- */

function emptyDb(): Database {
  return TABLES.reduce((acc, t) => {
    acc[t] = [];
    return acc;
  }, {} as Database);
}

let db: Database | null = null;

function normalize(raw: unknown): Database {
  const next = emptyDb();
  if (!raw || typeof raw !== "object") return next;
  for (const table of TABLES) {
    const rows = (raw as Record<string, unknown>)[table];
    if (Array.isArray(rows)) next[table] = rows as Row[];
  }
  return next;
}

function getDb(): Database {
  if (db) return db;
  const raw = safeGet(DB_KEY);
  if (raw) {
    try {
      db = normalize(JSON.parse(raw));
      return db;
    } catch {
      // Corrupted payload - start clean rather than crashing the app.
    }
  }
  db = emptyDb();
  return db;
}

function persist(): void {
  if (!db) return;
  const ok = safeSet(DB_KEY, JSON.stringify(db));
  if (!ok) console.warn("[bisnisKu] Penyimpanan lokal penuh, perubahan hanya tersimpan di sesi ini.");
}

export function isSeeded(): boolean {
  return safeGet(DB_KEY) !== null;
}

/** Loads the bundled backup once. Safe to call on every boot. */
export async function initLocalDb(): Promise<void> {
  if (isSeeded()) {
    getDb();
    return;
  }
  try {
    const res = await fetch(SEED_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Seed HTTP ${res.status}`);
    db = normalize(await res.json());
  } catch (err) {
    console.warn("[bisnisKu] Gagal memuat data awal, memulai dengan data kosong.", err);
    db = emptyDb();
  }
  persist();
}

export function exportDatabase(): Database {
  return JSON.parse(JSON.stringify(getDb())) as Database;
}

export function replaceDatabase(raw: unknown): void {
  db = normalize(raw);
  persist();
}

export function resetDatabase(): void {
  db = emptyDb();
  try {
    window.localStorage.removeItem(DB_KEY);
  } catch {
    memoryStore.delete(DB_KEY);
  }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function nextId(rows: Row[]): number {
  return rows.reduce((max, r) => (typeof r.id === "number" && r.id > max ? r.id : max), 0) + 1;
}

function nowIso(): string {
  return new Date().toISOString();
}

function stripUndefined(input: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(input)) if (v !== undefined) out[k] = v;
  return out;
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

function likeToRegExp(pattern: string, caseInsensitive: boolean): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
  return new RegExp(`^${escaped}$`, caseInsensitive ? "i" : "");
}

function coerce(value: string): string | number | boolean | null {
  if (value === "null") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  if (value !== "" && !Number.isNaN(Number(value))) return Number(value);
  return value;
}

type Filter = (row: Row) => boolean;

/** Parses a PostgREST `or(...)` expression, e.g. `name.ilike.%x%,code.eq.5`. */
function parseOr(expression: string): Filter {
  const clauses = expression.split(",").map((clause) => {
    const [column, operator, ...rest] = clause.split(".");
    const raw = rest.join(".");
    switch (operator) {
      case "ilike":
        return (row: Row) => likeToRegExp(raw, true).test(String(row[column] ?? ""));
      case "like":
        return (row: Row) => likeToRegExp(raw, false).test(String(row[column] ?? ""));
      case "neq":
        return (row: Row) => row[column] !== coerce(raw);
      case "gt":
        return (row: Row) => compare(row[column], coerce(raw)) > 0;
      case "gte":
        return (row: Row) => compare(row[column], coerce(raw)) >= 0;
      case "lt":
        return (row: Row) => compare(row[column], coerce(raw)) < 0;
      case "lte":
        return (row: Row) => compare(row[column], coerce(raw)) <= 0;
      default:
        return (row: Row) => row[column] === coerce(raw);
    }
  });
  return (row) => clauses.some((match) => match(row));
}

/* -------------------------------------------------------------------------- */
/* Query builder                                                               */
/* -------------------------------------------------------------------------- */

export interface QueryError {
  message: string;
}

export interface QueryResult<T> {
  data: T;
  error: QueryError | null;
}

type Action = "select" | "insert" | "update" | "delete";

/**
 * Rows are intentionally typed loosely (`any`) so the existing hooks can keep
 * mapping results straight onto their zod-inferred domain types, exactly like
 * the untyped remote client did.
 */
export type SingleQuery = PromiseLike<QueryResult<any>> & {
  catch: Promise<QueryResult<any>>["catch"];
};

class QueryBuilder implements PromiseLike<QueryResult<any[]>> {
  private action: Action = "select";
  private filters: Filter[] = [];
  private sorts: Array<{ column: string; ascending: boolean }> = [];
  private limitCount: number | null = null;
  private payload: Row[] = [];
  private wantsRows = true;
  private rowMode: "many" | "single" | "maybeSingle" = "many";

  constructor(private table: TableName) {}

  /* --- actions --- */

  select(_columns?: string): this {
    if (this.action === "select") this.action = "select";
    this.wantsRows = true;
    return this;
  }

  insert(values: Row | Row[]): this {
    this.action = "insert";
    this.payload = (Array.isArray(values) ? values : [values]).map(stripUndefined);
    this.wantsRows = false;
    return this;
  }

  update(values: Row): this {
    this.action = "update";
    this.payload = [stripUndefined(values)];
    this.wantsRows = false;
    return this;
  }

  delete(): this {
    this.action = "delete";
    this.wantsRows = false;
    return this;
  }

  /* --- filters --- */

  eq(column: string, value: unknown): this {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  neq(column: string, value: unknown): this {
    this.filters.push((row) => row[column] !== value);
    return this;
  }

  is(column: string, value: unknown): this {
    this.filters.push((row) => (row[column] ?? null) === (value ?? null));
    return this;
  }

  in(column: string, values: unknown[]): this {
    const set = new Set(values);
    this.filters.push((row) => set.has(row[column]));
    return this;
  }

  gt(column: string, value: unknown): this {
    this.filters.push((row) => compare(row[column], value) > 0);
    return this;
  }

  gte(column: string, value: unknown): this {
    this.filters.push((row) => compare(row[column], value) >= 0);
    return this;
  }

  lt(column: string, value: unknown): this {
    this.filters.push((row) => compare(row[column], value) < 0);
    return this;
  }

  lte(column: string, value: unknown): this {
    this.filters.push((row) => compare(row[column], value) <= 0);
    return this;
  }

  like(column: string, pattern: string): this {
    this.filters.push((row) => likeToRegExp(pattern, false).test(String(row[column] ?? "")));
    return this;
  }

  ilike(column: string, pattern: string): this {
    this.filters.push((row) => likeToRegExp(pattern, true).test(String(row[column] ?? "")));
    return this;
  }

  or(expression: string): this {
    this.filters.push(parseOr(expression));
    return this;
  }

  /* --- modifiers --- */

  order(column: string, options?: { ascending?: boolean }): this {
    this.sorts.push({ column, ascending: options?.ascending !== false });
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  single(): SingleQuery {
    this.rowMode = "single";
    this.wantsRows = true;
    return this as unknown as SingleQuery;
  }

  maybeSingle(): SingleQuery {
    this.rowMode = "maybeSingle";
    this.wantsRows = true;
    return this as unknown as SingleQuery;
  }

  /* --- execution --- */

  private matches(row: Row): boolean {
    return this.filters.every((filter) => filter(row));
  }

  private run(): Row[] {
    const data = getDb();
    const rows = data[this.table];

    if (this.action === "insert") {
      const created = this.payload.map((values) => {
        const row: Row = { ...values };
        if (typeof row.id !== "number") row.id = nextId(rows);
        row.created_at = row.created_at ?? nowIso();
        row.updated_at = row.updated_at ?? nowIso();
        rows.push(row);
        return row;
      });
      persist();
      return created;
    }

    if (this.action === "update") {
      const values = this.payload[0] ?? {};
      const touched: Row[] = [];
      for (let i = 0; i < rows.length; i++) {
        if (!this.matches(rows[i])) continue;
        rows[i] = { ...rows[i], ...values, updated_at: values.updated_at ?? nowIso() };
        touched.push(rows[i]);
      }
      persist();
      return touched;
    }

    if (this.action === "delete") {
      const removed = rows.filter((row) => this.matches(row));
      data[this.table] = rows.filter((row) => !this.matches(row));
      for (const cascade of CASCADES[this.table] ?? []) {
        const ids = new Set(removed.map((row) => row.id));
        data[cascade.table] = data[cascade.table].filter((child) => !ids.has(child[cascade.column]));
      }
      persist();
      return removed;
    }

    let result = rows.filter((row) => this.matches(row));
    for (const sort of [...this.sorts].reverse()) {
      result = [...result].sort((a, b) => {
        const diff = compare(a[sort.column], b[sort.column]);
        return sort.ascending ? diff : -diff;
      });
    }
    if (this.limitCount !== null) result = result.slice(0, this.limitCount);
    return result.map((row) => ({ ...row }));
  }

  private execute(): Promise<QueryResult<any>> {
    try {
      const rows = this.run();

      if (this.rowMode === "single") {
        if (rows.length === 0) {
          return Promise.resolve({ data: null, error: { message: "Data tidak ditemukan." } });
        }
        return Promise.resolve({ data: rows[0], error: null });
      }

      if (this.rowMode === "maybeSingle") {
        return Promise.resolve({ data: rows[0] ?? null, error: null });
      }

      return Promise.resolve({ data: this.wantsRows ? rows : null, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan pada penyimpanan lokal.";
      return Promise.resolve({ data: null, error: { message } });
    }
  }

  then<R1 = QueryResult<any[]>, R2 = never>(
    onfulfilled?: ((value: QueryResult<any[]>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
  ): Promise<R1 | R2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  catch<R = never>(onrejected?: ((reason: unknown) => R | PromiseLike<R>) | null): Promise<QueryResult<any[]> | R> {
    return this.execute().catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<QueryResult<any[]>> {
    return this.execute().finally(onfinally);
  }
}

/* -------------------------------------------------------------------------- */
/* File storage (pickup photos)                                                */
/* -------------------------------------------------------------------------- */

type FileMap = Record<string, string>;

function readFiles(): FileMap {
  const raw = safeGet(FILES_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as FileMap;
  } catch {
    return {};
  }
}

function writeFiles(files: FileMap): boolean {
  return safeSet(FILES_KEY, JSON.stringify(files));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Gagal membaca file."));
    reader.readAsDataURL(blob);
  });
}

class LocalBucket {
  async upload(
    path: string,
    body: Blob | File,
    // Accepted for API parity with the old remote client; irrelevant locally.
    _options?: { contentType?: string; upsert?: boolean; cacheControl?: string }
  ): Promise<{ data: { path: string } | null; error: QueryError | null }> {
    try {
      const dataUrl = await blobToDataUrl(body);
      const files = readFiles();
      files[path] = dataUrl;

      // Drop the oldest photos until the payload fits the storage quota.
      let keys = Object.keys(files);
      while (!writeFiles(files) && keys.length > 1) {
        const oldest = keys.find((k) => k !== path);
        if (!oldest) break;
        delete files[oldest];
        keys = Object.keys(files);
      }
      return { data: { path }, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload gagal.";
      return { data: null, error: { message } };
    }
  }

  getPublicUrl(path: string): { data: { publicUrl: string } } {
    return { data: { publicUrl: readFiles()[path] ?? "" } };
  }

  async remove(paths: string[]): Promise<{ error: QueryError | null }> {
    const files = readFiles();
    for (const path of paths) delete files[path];
    writeFiles(files);
    return { error: null };
  }
}

/* -------------------------------------------------------------------------- */
/* Public client                                                               */
/* -------------------------------------------------------------------------- */

const bucket = new LocalBucket();

export const localDb = {
  from(table: TableName): QueryBuilder {
    return new QueryBuilder(table);
  },
  storage: {
    from(_bucket: string) {
      return bucket;
    },
  },
};
