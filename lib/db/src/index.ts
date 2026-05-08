import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

function normalizeDbUrl(url: string): string {
  const isLocal =
    url.includes("localhost") ||
    url.includes("127.0.0.1") ||
    url.includes("helium");

  if (isLocal) {
    return url.replace(/[?&]sslmode=[^&]*/g, "");
  }

  return url.replace(
    /([?&])sslmode=(prefer|require|verify-ca)(&|$)/g,
    (_m, prefix, _mode, suffix) => `${prefix}sslmode=verify-full${suffix}`,
  );
}

const normalizedUrl = normalizeDbUrl(process.env.DATABASE_URL!);

const isLocal =
  normalizedUrl.includes("localhost") ||
  normalizedUrl.includes("127.0.0.1") ||
  normalizedUrl.includes("helium");

export const pool = new Pool({
  connectionString: normalizedUrl,
  ssl: isLocal ? false : { rejectUnauthorized: true },
});
export const db = drizzle(pool, { schema });

export * from "./schema";
