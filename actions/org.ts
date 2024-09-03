"use server";

import { pool, query } from "@/lib/db";
import { authorizeUser, oso } from "@/lib/oso";
import { Org, Role } from "@/lib/relations";
import { Result, handleError } from "@/lib/result";

// Determine which organizations this user can create users on.
export async function getCreateUserOrgs(
  username: string,
): Promise<Result<Org[]>> {
  const osoUser = { type: "User", id: username };

  // Determine the organizations for which the user has `create_user`
  // permissions. This controls whether the form for creating users displays, as
  // well as which orgs this user can create users for.
  const assignableOrgCond = await oso.listLocal(
    osoUser,
    "create_user",
    "Organization",
    "name",
  );

  // Inline the condition generated from `listLocal` into a query the get the
  // organization's names.
  const assignableOrgs = `SELECT organizations.name FROM organizations WHERE ${assignableOrgCond}`;
  const client = await pool.connect();
  try {
    const value = await client.query<Org>(assignableOrgs);
    return { success: true, value: value.rows };
  } catch (error) {
    return handleError(error);
  } finally {
    client.release();
  }
}

export async function canCreateOrg(
  requestor: string,
): Promise<Result<boolean>> {
  const client = await pool.connect();
  try {
    const auth = await authorizeUser(client, requestor, "create", {
      type: "Organization",
      id: "",
    });

    return { success: true, value: auth };
  } catch (error) {
    return handleError(error);
  } finally {
    client.release();
  }
}

// Create a new organization
export async function createOrg(
  // Bound parameter because `createUser` is used as a form action.
  p: { requestor: string },
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const data = {
    name: formData.get("orgName") as string,
  };

  const client = await pool.connect();
  try {
    const auth = await authorizeUser(client, p.requestor, "create", {
      type: "Organization",
      id: data.name,
    });
    if (!auth) {
      return handleError(`not permitted to create Organization ${data.name}`);
    }

    await client.query(`INSERT INTO organizations (name) VALUES ($1);`, [
      data.name,
    ]);
    return { success: true, value: null };
  } catch (error) {
    return handleError(error);
  } finally {
    client.release();
  }
}

export async function getOrgRoles(): Promise<Result<Role[]>> {
  try {
    const value = await query<Role>(
      `SELECT DISTINCT unnest(enum_range(NULL::organization_role)) AS name`,
      [],
    );
    return { success: true, value };
  } catch (error) {
    return handleError(error);
  }
}
