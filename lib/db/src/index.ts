import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// pg-connection-string emits a deprecation warning when it encounters
// sslmode=prefer/require/verify-ca, because those values will change semantics
// in pg v9.  Normalise the URL to sslmode=verify-full (the current behaviour)
// before handing it to Pool so the warning is never triggered.
function normalizeDbUrl(url: string): string {
  return url.replace(
    /([?&])sslmode=(prefer|require|verify-ca)(&|$)/g,
    (_m, prefix, _mode, suffix) => `${prefix}sslmode=verify-full${suffix}`,
  );
}

export const pool = new Pool({
  connectionString: normalizeDbUrl(process.env.DATABASE_URL!),
});
export const db = drizzle(pool, { schema });

export * from "./schema";
