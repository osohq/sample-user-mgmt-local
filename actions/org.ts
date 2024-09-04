"use server";

import { pool, query } from "@/lib/db";
import { authorizeUser, oso } from "@/lib/oso";
import { Org, Role } from "@/lib/relations";
import { Result, handleError } from "@/lib/result";

/**
 * Determine if the requestor can create organizations.
 *
 * ## Oso documentation
 * This function demonstrates a preemptive check appropriate for determining if
 * a component should render or not.
 */
export async function canCreateOrg(
  requestor: string,
): Promise<Result<boolean>> {
  const client = await pool.connect();
  try {
    const auth = await authorizeUser(client, requestor, "create", {
      type: "Organization",
      // Ensure user has `create` privilege on an arbitrary, non-existent
      // organization. This API will be more ergonomic once local authorization
      // has the query builder API.
      id: "",
    });

    return { success: true, value: auth };
  } catch (error) {
    return handleError(error);
  } finally {
    client.release();
  }
}

/**
 * Create a new organization.
 *
 * Requires that the user has the `create` permission on the organization. Once
 * the Oso Node SDK supports the query builder API, this will become a check
 * that the user has a global permission to create organizations.
 *
 * ## Oso documentation
 * This function demonstrates a standard write path––determining the user has
 * permission to write the data, and permitting the write to occur only if they
 * do.
 */
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

/**
 * Determine which organizations this user can create users on.
 *
 * ## Oso documentation
 * This function demonstrates a standard "authorized list" query, returning a
 * set of resources that the requestor has a specific permission on.
 */
export async function getCreateUserOrgs(
  username: string,
): Promise<Result<Org[]>> {
  const osoUser = { type: "User", id: username };

  // Determine the organizations for which the user has `create_user`
  // permissions.
  const canCreateUserOrgCond = await oso.listLocal(
    osoUser,
    "create_user",
    "Organization",
    "name",
  );

  // Inline the condition generated from `listLocal` into a query the get the
  // organization's names.
  const canCreateUserOrg = `SELECT organizations.name FROM organizations WHERE ${canCreateUserOrgCond}`;
  const client = await pool.connect();
  try {
    const value = await client.query<Org>(canCreateUserOrg);
    return { success: true, value: value.rows };
  } catch (error) {
    return handleError(error);
  } finally {
    client.release();
  }
}

/**
 * Fetch the roles that exist on organizations.
 */
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
