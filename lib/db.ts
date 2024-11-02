import { Pool, QueryResult } from "pg";

import { getEnvVar } from "./util";

const user = getEnvVar("DB_USER");
const password = getEnvVar("DB_PASS");
const host = getEnvVar("DB_HOST");
const port = getEnvVar("DB_PORT");
const ssl = getEnvVar("DB_SSL");

/**
 * Creates a new PostgreSQL connection pool.
 *
 * @param {string} database - The name of the PostgreSQL database to connect to.
 * @returns {Pool} - A new instance of a PostgreSQL connection pool.
 *
 * This function constructs a PostgreSQL connection string using environment
 * variables + a specified database name, and then returns a new connection pool
 * using the provided database name.
 *
 * Example:
 * ```typescript
 * const pool = newPool('users');
 * ```
 */
export function newPool(database: string): Pool {
  const connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}?sslmode=${ssl}`;
  return new Pool({ connectionString });
}

/**
 * DB client for user management service.
 */
export const usersPool = newPool("users");
export const docsPool = newPool("documents");
export const crmPool = newPool("crm");

// Function to execute a query with parameters
export async function query<T>(
  pool: Pool,
  text: string,
  params?: any[]
): Promise<T[]> {
  console.log("Executing query:", text);
  if (params) {
    console.log("With parameters:", params);
  }

  try {
    const res: QueryResult = await pool.query(text, params);
    console.log("Query result:", res.rows);
    console.log("Affected rows:", res.rowCount);
    return res.rows as T[];
  } catch (err) {
    console.error("Error executing query:", text, "Error:", err);
    throw err;
  }
}
