"use server";

import { typedVar } from "oso-cloud";

import { usersPool as pool } from "@/lib/db";
import { authorizeUser, osoUserMgmt as oso } from "@/lib/oso";
import { User } from "@/lib/relations";
import { Result, stringifyError } from "@/lib/result";

/**
 * Identifies a `User`, as well as fields describing its permissions on its
 * parent organization.
 */
export interface UserWOrgPermissions extends User {
  readOrg: boolean;
  createUser: boolean;
  scheduleAppointment: boolean;
}

/**
 * Fetches the specified user, as well as their permissions on their
 * organization.
 *
 * This is a super-admin-like function that intentionally omits any
 * authorization.
 *
 * ## Oso documentation
 * Demonstrates a the `actionsLocal` API, which is useful for fetching all of a
 * user's permissions in a single query.
 *
 * @throws {Error} If there is a problem with the database connection or the
 * user does not exist.
 */
export async function getUserWOrgPermissions(
  username: string
): Promise<UserWOrgPermissions> {
  const osoUser = { type: "User", id: username };
  const client = await pool.connect();
  try {
    const userRes = await client.query<User>(
      `SELECT username, org, role
      FROM users
      WHERE username = $1`,
      [username]
    );
    if (userRes.rowCount != 1) {
      throw new Error(`cannot find User ${username}`);
    }
    const user = userRes.rows[0];

    const actionsQuery = await oso.actionsLocal(osoUser, {
      type: "Organization",
      id: user.org,
    });

    const orgActionsQuery = `
    SELECT array_agg(actions) AS actions FROM (
        ${actionsQuery}
    ) AS actions`;

    const res = await client.query<{ actions: string[] }>(orgActionsQuery);

    let orgActions = res.rows[0].actions;
    if (!orgActions) {
      orgActions = [];
    }

    return {
      ...user,
      readOrg: orgActions.includes("read"),
      createUser: orgActions.includes("create_user"),
      scheduleAppointment: orgActions.includes("schedule_appointment"),
    };
  } catch (error) {
    console.error("Error in getUser:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Identifies a `User` the requestor is permitted to read, as well as fields
 * describing other permissions.
 */
export interface ReadableUser extends User {
  editRole: boolean;
  deleteUser: boolean;
}

/**
 * Get the list of users which `requestor` can `read`, as well as additional
 * information about permissions on those users.
 *
 * This data can include the requestor's own data, so the requestor might need
 * to be filtered out before using the data.
 *
 * ## Oso documentation
 * Demonstrates an advanced form of local authorization, which:
 * - Includes an `and` condition, which ensures that the requestor has the
 *   `read` permission on all returned users.
 * - Takes a query generated from local auth and performs aggregations and joins
 *   on it.
 *
 * @throws {Error} If there is a problem with the database connection.
 */
export async function getReadableUsersWithPermissions(
  requestor: string
): Promise<ReadableUser[]> {
  const osoUser = { type: "User", id: requestor };
  const client = await pool.connect();
  try {
    const actionVar = typedVar("String");
    const userVar = typedVar("User");
    const usersActions = await oso
      .buildQuery(["allow", osoUser, actionVar, userVar])
      // `requestor` must have `read` permission on all users.
      .and(["allow", osoUser, "read", userVar])
      .evaluateLocalSelect({
        actions: actionVar,
        username: userVar,
      });

    const usersWActions = await client.query<{
      username: string;
      role: string;
      org: string;
      actions: string[];
    }>(
      `SELECT users.username, role, org, actions_per_user.actions
      FROM (
        -- Get all actions for each user
        SELECT username, array_agg(actions) AS actions
        FROM (
          ${usersActions}
        ) AS user_actions
        GROUP BY user_actions.username
      ) AS actions_per_user
      JOIN users ON actions_per_user.username = users.username`
    );

    return usersWActions.rows.map((user) => ({
      ...user,
      editRole: user.actions.includes("edit_role"),
      deleteUser: user.actions.includes("delete"),
    }));
  } catch (error) {
    console.error("Error in getReadableUsersWithPermissions:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Creates a new user on an organization with a specified role.
 *
 * Requires `requestor` to have the `create_user` permission on the
 * organization.
 *
 * ## Oso documentation
 * Demonstrates a standard authorized endpoint––ensuring the user has a specific
 * permission, and permitting it to occur only if they do.
 *
 * Also demonstrates using `batch` to synchronize changes to Oso's centralized
 * authorization data.
 *
 * @throws {Error} If there is a problem with the database connection or
 * authorization fails.
 */
export async function createUser(
  // Bound parameter because `createUser` is used as a form action.
  p: { requestor: string },
  _prevState: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  const data = {
    username: formData.get("username")! as string,
    org: formData.get("organization")! as string,
    role: formData.get("role")! as string,
  };

  const client = await pool.connect();
  try {
    const org = {
      type: "Organization",
      id: data.org,
    };
    const auth = await authorizeUser(
      oso,
      client,
      p.requestor,
      "create_user",
      org
    );
    if (!auth) {
      return {
        success: false,
        error: `not permitted to create user in Organization ${data.org}`,
      };
    }

    await client.query(
      `INSERT INTO users (username, org, role) VALUES ($1, $2, $3::organization_role);`,
      [data.username, data.org, data.role]
    );

    const user = {
      type: "User",
      id: data.username,
    };

    // Propagate user roles to Oso's centralized authorization data store for
    // other services to use.
    await oso.batch((tx) => {
      tx.insert(["has_role", user, data.role, org]);
      tx.insert(["has_relation", user, "parent", org]);
    });

    return { success: true, value: data.username };
  } catch (error) {
    return { success: false, error: stringifyError(error) };
  } finally {
    client.release();
  }
}

/**
 * Deletes the specified user.
 *
 * Requires `requestor` to have the `delete` permission for the specified user.
 *
 * ## Oso documentation
 * Demonstrates a standard authorized endpoint––ensuring the user has a specific
 * permission, and permitting it to occur only if they do.
 *
 * Also demonstrates using `batch` to synchronize changes to Oso's centralized
 * authorization data.
 *
 * @throws {Error} If there is a problem with the database connection or
 * authorization fails.
 */
export async function deleteUser(
  requestor: string,
  username: string
): Promise<undefined> {
  const client = await pool.connect();
  try {
    const auth = await authorizeUser(oso, client, requestor, "delete", {
      type: "User",
      id: username,
    });
    if (!auth) {
      throw new Error(`not permitted to delete User ${username}`);
    }

    const res = await client.query<{ org: string; role: string }>(
      `DELETE FROM users WHERE username = $1 RETURNING org, role;`,
      [username]
    );
    if (res.rowCount !== 1) {
      throw new Error(`cannot find user ${username}`);
    }
    const resReturnValues = res.rows[0];

    const user = {
      type: "User",
      id: username,
    };
    const org = {
      type: "Organization",
      id: resReturnValues.org,
    };

    // Propagate user roles to Oso's centralized authorization data store for
    // other services to use.
    await oso.batch((tx) => {
      tx.delete(["has_role", user, resReturnValues.role, org]);
      tx.delete(["has_relation", user, "parent", org]);
    });

    return;
  } catch (error) {
    console.error("Error in deleteUser:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Edits a set of users' roles, identifying the users by their username.
 *
 * Requires `requestor` to have the `edit` permission on all edited users.
 *
 * ## Oso documentation
 * Demonstrates a complex approach to authorizing many resources at once using
 * local authorization, relying on a transaction to verify authorization
 * occurred as the requestor expected.
 *
 * Also demonstrates using `batch` to synchronize changes to Oso's centralized
 * authorization data.
 *
 * @throws {Error} If there is a problem with the database connection, or the
 * requestor cannot does not have permission to edit all requested users.
 */
export async function editUsersRoleByUsername(
  requestor: string,
  updates: User[]
): Promise<undefined> {
  if (updates.length === 0) {
    return;
  }
  const client = await pool.connect();

  const osoUser = { type: "User", id: requestor };

  try {
    // Ensure that this user has `edit_role` permission for all users being
    // updated. We perform this as a `listLocal` operation because there are an
    // arbitrary number of users that could be updated here.
    const editRoleAuthorized = await oso.listLocal(
      osoUser,
      "edit_role",
      "User",
      "users.username"
    );

    // Ensure that the users edited are part of the set of users the requestor
    // has `edit_role` permissions on.
    const queryText = `
        UPDATE users
        SET role = v.role::organization_role
        FROM (VALUES
          ${updates.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(", ")}
        ) AS v(username, role)
        WHERE users.username = v.username AND ${editRoleAuthorized}
        RETURNING users.username, users.org, users.role;
      `;

    const userFields: string[] = updates.flatMap((user) => [
      user.username,
      user.role,
    ]);

    await client.query("BEGIN");
    const res = await client.query<User>(queryText, userFields);

    // Check the affected row count, which is our signal that there is a
    // discrepancy between the number of users submitted and the number of users
    // that passed the condition expressed by `editRoleAuthorized`.
    if (res.rowCount !== updates.length) {
      // If these numbers do not align, abort the operation.
      throw new Error(`not permitted to edit role of all submitted users`);
    }
    // If these numbers aligned things are good.
    client.query("COMMIT");

    // Synchronize user's new role to Oso's centralized authorization data for
    // use in other services.
    await oso.batch((tx) => {
      // Insert new values.
      updates.map((user) =>
        tx.insert([
          "has_role",
          { type: "User", id: user.username },
          user.role,
          { type: "Organization", id: user.org },
        ])
      );
      // Delete current values.
      res.rows.map((user) => {
        tx.delete([
          "has_role",
          { type: "User", id: user.username },
          user.role,
          { type: "Organization", id: user.org },
        ]);
      });
    });

    return;
  } catch (error) {
    client.query("ROLLBACK");
    console.error("Error in editUsersRoleByUsername:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get all users in a specified organization for which `requestor` has the
 * `read` permission.
 *
 * ## Oso documentation
 * This function demonstrates a standard read path with local authorization,
 * relying on `listLocal` to generate a condition for a query.
 *
 * @throws {Error} If there is a problem with the database connection.
 */
export async function getOrgUsers(
  requestor: string,
  org: string
): Promise<User[]> {
  const client = await pool.connect();
  try {
    const osoUser = { type: "User", id: requestor };
    const userVar = typedVar("User");
    const osoOrg = { type: "Organization", id: org };

    // Determine the users for which this user has `read` permissions in the
    // specified `org`.
    const readableUsersCond = await oso
      .buildQuery(["allow", osoUser, "read", userVar])
      .and(["has_relation", userVar, "parent", osoOrg])
      .evaluateLocalFilter("username", userVar);

    const orgUsers = await client.query<User>(
      `SELECT username, org, role
        FROM users
        WHERE ${readableUsersCond}
        ORDER BY username`
    );

    return orgUsers.rows;
  } catch (error) {
    console.error("Error in getOrgUsers:", error);
    throw error;
  } finally {
    client.release();
  }
}
