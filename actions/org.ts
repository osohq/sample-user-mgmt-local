"use server";

import { usersPool as pool, query } from "@/lib/db";
import { authorizeUser, osoUserMgmt as oso } from "@/lib/oso";
import { Org, Role } from "@/lib/relations";
import { Result, stringifyError } from "@/lib/result";

/**
 * Checks whether `requestor` has the necessary authorization to create an
 * organization, which can be useful for conditionally rendering UI components
 * based on user permissions.
 *
 * ## Oso documentation
 * This function demonstrates how to check for a global permission.
 *
 * @throws {Error} If there is a problem with the database connection.
 */
export async function canCreateOrg(requestor: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    return await authorizeUser(oso, client, requestor, "create_org");
  } catch (error) {
    console.error("Error in canCreateOrg:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Create a new organization.
 *
 * Requires that the user has the `create_org` `global` permission.
 *
 * ## Oso documentation
 * This function demonstrates a standard write path––determining the user has
 * permission to write the data, and permitting the write to occur only if they
 * do. However, unlike many standard write paths, this function relies on a
 * `global` permission.
 */
export async function createOrg(
  // Bound parameter because `createUser` is used as a form action.
  p: { requestor: string },
  _prevState: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  const data = {
    name: formData.get("orgName")! as string,
  };

  const client = await pool.connect();
  try {
    const auth = await await authorizeUser(
      oso,
      client,
      p.requestor,
      "create_org"
    );
    if (!auth) {
      throw new Error(`not permitted to create Organization ${data.name}`);
    }

    await client.query(`INSERT INTO organizations (name) VALUES ($1);`, [
      data.name,
    ]);
    return { success: true, value: data.name };
  } catch (error) {
    console.error("Error in createOrg:", error);
    return { success: false, error: stringifyError(error) };
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
 *
 * @throws {Error} If there is a problem with the database connection.
 */
export async function getCreateUserOrgs(username: string): Promise<Org[]> {
  // Inline the condition generated from `listLocal` into a query the get the
  // organization's names.
  const client = await pool.connect();
  try {
    const osoUser = { type: "User", id: username };

    // Determine the organizations for which the user has `create_user`
    // permissions.
    const canCreateUserOrgCond = await oso.listLocal(
      osoUser,
      "create_user",
      "Organization",
      "name"
    );

    // Inline the condition generated from `listLocal` into a query the get the
    // organization's names.
    const canCreateUserOrg = `SELECT organizations.name FROM organizations WHERE ${canCreateUserOrgCond}`;
    const value = await client.query<Org>(canCreateUserOrg);
    return value.rows;
  } catch (error) {
    console.error("Error in getCreateUserOrgs:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Fetch the roles that exist on organizations.
 *
 * @throws {Error} If there is a problem with the database connection.
 */
export async function getOrgRoles(): Promise<Role[]> {
  return query<Role>(
    pool,
    `SELECT DISTINCT name FROM unnest(enum_range(NULL::organization_role)) AS name
    WHERE name != 'admin'`
  );
}
