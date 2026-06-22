// Couche d'accès SQLite agnostique au runtime.
// C'est l'unique "joint" spécifique au runtime du POC : Bun et Node.js
// embarquent chacun un client SQLite natif, mais avec des API différentes
// (bun:sqlite vs node:sqlite). On les masque derrière une petite interface.

export interface Db {
  exec(sql: string): void;
  run(sql: string, ...params: unknown[]): void;
  get<T>(sql: string, ...params: unknown[]): T | undefined;
  all<T>(sql: string, ...params: unknown[]): T[];
}

const isBun = typeof (globalThis as any).Bun !== "undefined";

async function createDb(): Promise<Db> {
  if (isBun) {
    const { Database } = await import("bun:sqlite");
    const sqlite = new Database(":memory:");
    return {
      exec: (sql) => { sqlite.run(sql); },
      run: (sql, ...p) => { sqlite.query(sql).run(...(p as any)); },
      get: (sql, ...p) => sqlite.query(sql).get(...(p as any)) as any,
      all: (sql, ...p) => sqlite.query(sql).all(...(p as any)) as any,
    };
  }
  const { DatabaseSync } = await import("node:sqlite");
  const sqlite = new DatabaseSync(":memory:");
  return {
    exec: (sql) => { sqlite.exec(sql); },
    run: (sql, ...p) => { sqlite.prepare(sql).run(...(p as any)); },
    get: (sql, ...p) => sqlite.prepare(sql).get(...(p as any)) as any,
    all: (sql, ...p) => sqlite.prepare(sql).all(...(p as any)) as any,
  };
}

export const db = await createDb();

db.exec(`
  CREATE TABLE IF NOT EXISTS links (
    code       TEXT PRIMARY KEY,
    url        TEXT NOT NULL,
    hits       INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
`);
