"use server";

import { pool } from "@/lib/db";
import { oso } from "@/lib/oso";
import { Org } from "@/lib/relations";
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

// Create a new organization
//
// TODO: add authorization here once
// https://github.com/osohq/oso-service/pull/3127
export async function createOrg(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const data = {
    name: formData.get("orgName"),
  };

  const client = await pool.connect();
  try {
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
