import { PoolClient } from "pg";
import { Oso, IntoValue, Value } from "oso-cloud";

import { getEnvVar } from "./util";

const key = getEnvVar("OSO_CLOUD_API_KEY");
const osoHost = getEnvVar("OSO_URL");

export const oso = new Oso(osoHost, key, {
  dataBindings: "/app/oso_local_auth.yaml",
});

/**
 * Convenience function to authorizes `user` to perform `permission` on
 * `resource` using local authorization.
 *
 * ## Oso documentation
 * Demonstrates the most standard use of local authorization in which Oso
 * provides the full query to execute to determine authorization.
 *
 * @throws {Error} If there is a problem with the database connection.
 */
export async function authorizeUser(
  client: PoolClient,
  username: string,
  permission: string,
  resource: IntoValue<Value>
): Promise<boolean> {
  const osoUser = { type: "User", id: username };

  try {
    const authQuery = await oso.authorizeLocal(osoUser, permission, resource);
    const r = await client.query<{ allowed: boolean }>(authQuery);
    const allowed = r.rows[0].allowed;
    return allowed;
  } catch (err) {
    throw err;
  }
}
