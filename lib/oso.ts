import { PoolClient } from "pg";
import { Oso, IntoValue, Value } from "oso-cloud";

import { getEnvVar } from "./util";

const key = getEnvVar("OSO_CLOUD_API_KEY");
const osoHost = getEnvVar("OSO_URL");

/**
 * Oso client for user management service.
 */
export const osoUserMgmt = new Oso(osoHost, key, {
  dataBindings: "/app/oso_local_auth_user_mgmt.yml",
});

/**
 * Convenience function to authorizes `user` to perform `permission` on
 * `resource` using local authorization.
 *
 * `resource` can be `null` when checking `global` permissions.
 *
 * ## Oso documentation
 * Demonstrates the most standard use of local authorization in which Oso
 * provides the full query to execute to determine authorization.
 *
 * @throws {Error} If there is a problem with the database connection.
 */
export async function authorizeUser(
  oso: Oso,
  client: PoolClient,
  username: string,
  permission: string,
  resource?: IntoValue<Value>
): Promise<boolean> {
  const osoUser = { type: "User", id: username };

  const args = resource
    ? // standard resource check
      (["allow", osoUser, permission, resource] as [
        string,
        Value,
        IntoValue<Value>,
        Value
      ])
    : // global permission check
      (["has_permission", osoUser, permission] as [
        string,
        Value,
        IntoValue<Value>
      ]);

  try {
    const authQuery = await oso.buildQuery(args).evaluateLocalSelect();
    const r = await client.query<{ result: boolean }>(authQuery);
    const allowed = r.rows[0].result;
    return allowed;
  } catch (err) {
    console.error("Error in authorizeUser:", err);
    throw err;
  }
}
