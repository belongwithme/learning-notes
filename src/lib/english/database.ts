import pg from "pg";
import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";

// Only expose the query/session API used here; driver-specific stream overloads differ.
interface Queries {
  query<R extends pg.QueryResultRow = any>(
    text: string,
    values?: unknown[],
  ): Promise<pg.QueryResult<R>>;
}
export interface DatabaseClient extends Queries {
  release(): void;
}
interface DatabasePool extends Queries {
  connect(): Promise<DatabaseClient>;
  end(): Promise<void>;
}

// Share the same session-based transport between the website, CLI and migrations.
// Local/other PostgreSQL databases keep TCP; Neon uses its TLS WebSocket endpoint.
export function createPool(connectionString: string): DatabasePool {
  const isNeon = new URL(connectionString).hostname.endsWith(".neon.tech");
  if (isNeon) neonConfig.webSocketConstructor = WebSocket;
  const Pool = isNeon ? NeonPool : pg.Pool;
  return new Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  });
}
