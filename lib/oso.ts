import { PoolClient } from "pg";
import { Oso, IntoValue, Value } from "oso-cloud";

const key = process.env.OSO_CLOUD_API_KEY;
if (!key) {
  throw new Error(`OSO_CLOUD_API_KEY not set in .env`);
}

export const oso = new Oso("https://cloud.osohq.com", key, {
  dataBindings: "/app/oso-local-auth.yaml",
});

/**
 * Convenience function for checking authorization requests against the local
 * database.
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
