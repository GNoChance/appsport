import { AsyncLocalStorage } from 'node:async_hooks';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import {
  CompiledQuery,
  type DatabaseConnection,
  type DatabaseIntrospector,
  type Dialect,
  type DialectAdapter,
  type Driver,
  type Kysely,
  type QueryCompiler,
  type QueryResult,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
} from 'kysely';

const REENTRANT_QUERY = 'Requête sur db pendant une transaction ouverte : utiliser trx';

/**
 * Le pilote sérialise lui-même l'unique connexion (mutex et détection de réentrance) : le mutex
 * générique de Kysely, pris avant `acquireConnection`, bloquerait une requête réentrante au lieu de lever.
 */
class NodeSqliteAdapter extends SqliteAdapter {
  override get supportsMultipleConnections(): boolean {
    return true;
  }
}

class NodeSqliteConnection implements DatabaseConnection {
  readonly #db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.#db = db;
  }

  async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    const stmt = this.#db.prepare(compiledQuery.sql);
    const params = compiledQuery.parameters as SQLInputValue[];
    if (stmt.columns().length > 0) {
      return { rows: stmt.all(...params) as R[] };
    }
    const { changes, lastInsertRowid } = stmt.run(...params);
    return { numAffectedRows: BigInt(changes), insertId: BigInt(lastInsertRowid), rows: [] };
  }

  async *streamQuery<R>(compiledQuery: CompiledQuery): AsyncIterableIterator<QueryResult<R>> {
    const stmt = this.#db.prepare(compiledQuery.sql);
    for (const row of stmt.iterate(...(compiledQuery.parameters as SQLInputValue[]))) {
      yield { rows: [row as R] };
    }
  }
}

interface Lease {
  release(): void;
}

class NodeSqliteDriver implements Driver {
  readonly #db: DatabaseSync;
  readonly #connection: NodeSqliteConnection;
  readonly #transactionLease = new AsyncLocalStorage<Lease>();
  #queue: Promise<void> = Promise.resolve();
  #holder: Lease | null = null;

  constructor(db: DatabaseSync) {
    this.#db = db;
    this.#connection = new NodeSqliteConnection(db);
  }

  async init(): Promise<void> {}

  async acquireConnection(): Promise<DatabaseConnection> {
    if (this.#holder !== null && this.#transactionLease.getStore() === this.#holder) {
      throw new Error(REENTRANT_QUERY);
    }
    let release!: () => void;
    const turn = new Promise<void>((resolve) => {
      release = resolve;
    });
    const previous = this.#queue;
    this.#queue = previous.then(() => turn);
    await previous;
    this.#holder = { release };
    return this.#connection;
  }

  async beginTransaction(connection: DatabaseConnection): Promise<void> {
    // Marque le contexte asynchrone avant tout await : le callback de la transaction en hérite,
    // et une requête sur `db` lancée depuis ce callback lève au lieu d'attendre le mutex.
    if (this.#holder !== null) this.#transactionLease.enterWith(this.#holder);
    await connection.executeQuery(CompiledQuery.raw('BEGIN IMMEDIATE'));
  }

  async commitTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('COMMIT'));
  }

  async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    // SQLite annule de lui-même certaines transactions en erreur : ne pas masquer l'erreur d'origine.
    if (this.#db.isTransaction) await connection.executeQuery(CompiledQuery.raw('ROLLBACK'));
  }

  async savepoint(connection: DatabaseConnection, name: string): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw(`SAVEPOINT ${quoteIdentifier(name)}`));
  }

  async rollbackToSavepoint(connection: DatabaseConnection, name: string): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw(`ROLLBACK TO ${quoteIdentifier(name)}`));
  }

  async releaseSavepoint(connection: DatabaseConnection, name: string): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw(`RELEASE ${quoteIdentifier(name)}`));
  }

  async releaseConnection(): Promise<void> {
    const holder = this.#holder;
    this.#holder = null;
    holder?.release();
  }

  // La base appartient à l'appelant d'openDatabase, qui la ferme.
  async destroy(): Promise<void> {}
}

function quoteIdentifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

export class NodeSqliteDialect implements Dialect {
  readonly #database: DatabaseSync;

  constructor(cfg: { database: DatabaseSync }) {
    this.#database = cfg.database;
  }

  createDriver(): Driver {
    return new NodeSqliteDriver(this.#database);
  }

  createQueryCompiler(): QueryCompiler {
    return new SqliteQueryCompiler();
  }

  createAdapter(): DialectAdapter {
    return new NodeSqliteAdapter();
  }

  // biome-ignore lint/suspicious/noExplicitAny: signature imposée par l'interface Dialect de Kysely
  createIntrospector(db: Kysely<any>): DatabaseIntrospector {
    return new SqliteIntrospector(db);
  }
}
