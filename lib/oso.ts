import { PoolClient } from "pg";
import { Oso, IntoValue, Value } from "oso-cloud";

import { Result, handleError } from "@/lib/result";

const key = process.env.OSO_CLOUD_API_KEY;
if (!key) {
  throw new Error(`OSO_CLOUD_API_KEY not set in .env`);
}

export const oso = new Oso("https://cloud.osohq.com", key, {
  dataBindings: "/app/oso-local-auth.yaml",
});

export async function authorizeUser(
  client: PoolClient,
  username: string,
  permission: string,
  resource: IntoValue<Value>,
): Promise<boolean> {
  const osoUser = { type: "User", id: username };

  try {
    const createUserQuery = await oso.authorizeLocal(
      osoUser,
      permission,
      resource,
    );
    // Authorize `create_user` permission on user.
    const r = await client.query<Boolean>(createUserQuery);
    const allowed = r.rows[0].valueOf();
    return allowed;
  } catch (err) {
    throw err;
  }
}
