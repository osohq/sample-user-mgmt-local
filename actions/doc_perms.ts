// This file manages permissions/authorization-related features of the document
// service. It's separated from the primary document API just for
// maintainability's sake.

"use server";

import { docsPool as pool } from "@/lib/db";
import { authorizeUser, osoDocMgmt as oso } from "@/lib/oso";
import { DocumentUserRole, Role } from "@/lib/relations";
import { Result, stringifyError } from "@/lib/result";
import { PoolClient } from "pg";

export async function auth(
  client: PoolClient,
  requestor: string,
  permission: string,
  id: number
): Promise<boolean> {
  try {
    const auth = await authorizeUser(oso, client, requestor, permission, {
      type: "Document",
      id: id.toString(),
    });

    return auth;
  } catch (error) {
    console.error("Error in doc_perms auth:", error);
    throw error;
  }
}

export async function list(
  client: PoolClient,
  requestor: string,
  permission: string
): Promise<number[]> {
  try {
    const osoUser = { type: "User", id: requestor };

    // Determine the organizations for which the user has `create_user`
    // permissions.
    const permissionsCond = await oso.listLocal(
      osoUser,
      permission,
      "Document",
      "document_id"
    );

    const permittedDocs = `SELECT document_id AS id FROM document_user_roles WHERE ${permissionsCond}`;
    const docs = await client.query<{ id: number }>(permittedDocs);
    return docs.rows.map((row) => row.id);
  } catch (error) {
    console.error("Error in list:", error);
    throw error;
  }
}

export async function actions(
  client: PoolClient,
  requestor: string,
  id: number
): Promise<string[]> {
  try {
    return await actions_inner(client, requestor, id);
  } catch (error) {
    console.error("Error in doc_perms actions:", error);
    throw error;
  }
}

async function actions_inner(
  client: PoolClient,
  requestor: string,
  id: number
): Promise<string[]> {
  const osoUser = { type: "User", id: requestor };
  const document = {
    type: "Document",
    id: id.toString(),
  };

  try {
    // Determine actions available on document.
    const actionsQuery = await oso.actionsLocal(osoUser, document);
    const docActionsRes = `
        SELECT array_agg(actions) AS actions FROM (
            ${actionsQuery}
        ) AS actions`;

    const docsActions = await client.query<{ actions: string[] }>(
      docActionsRes
    );

    const rows = docsActions.rows;
    if (rows.length != 1) {
      throw new Error(`cannot find Document ${id}`);
    }

    return rows[0].actions;
  } catch (error) {
    console.error("Error in doc_perms actions_inner:", error);
    throw error;
  }
}

/**
 * Get all users and their roles on the specified document.
 *
 * Requires `requestor` to have the `manage_share` permission on the document.
 * Additionally, this function returns only users on which the requestor has the
 * `read` permission.
 *
 * ## Oso documentation
 * Demonstrates complex, multi-tiered authorization. The requestor must have
 * permissions on both a primary resource, as well as a list of resources
 * associated with it.
 *
 * @throws {Error} If there is a problem with the database connection or the
 * action is not permitted.
 */
export async function getDocUserRoles(
  requestor: string,
  id: number
): Promise<DocumentUserRole[]> {
  const client = await pool.connect();
  try {
    const auth = await authorizeUser(oso, client, requestor, "manage_share", {
      type: "Document",
      id: `${id}`,
    });
    if (!auth) {
      throw new Error(`not permitted to read details of Document ${id}`);
    }

    const osoUser = { type: "User", id: requestor };

    // Determine the users for which the user has `read` permission.
    const readableUsersCond = await oso.listLocal(
      osoUser,
      "read",
      "User",
      "username"
    );

    const docUserRoles = await client.query<DocumentUserRole>(
      `SELECT document_id AS id, username, "role"
          FROM document_user_roles
          WHERE document_id = $1 AND ${readableUsersCond};`,
      [id]
    );

    return docUserRoles.rows;
  } catch (error) {
    console.error("Error in getDocUserRoles:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get all roles that the user can assign to the specified ID.
 *
 * Requires `requestor` to have `manage_share` permission on the document. The
 * set of roles includes the `owner` role iff `requestor` has the `assign_owner`
 * permission.
 *
 * ## Oso documentation
 * Demonstrates complex, multi-layered authorization.
 *
 * @throws {Error} If there is a problem with the database connection.
 */
export async function getAssignableDocRoles(
  requestor: string,
  id: number
): Promise<Role[]> {
  const client = await pool.connect();
  try {
    const docActions = await actions_inner(client, requestor, id);
    if (!docActions.includes("manage_share")) {
      return [];
    }

    const value = await client.query<Role>(
      `SELECT DISTINCT unnest(enum_range(NULL::document_role)) AS name`
    );
    let roles = value.rows;

    if (!docActions.includes("assign_owner")) {
      roles = roles.filter((role) => role.name != "owner");
    }

    return roles;
  } catch (error) {
    console.error("Error in getAssignableDocRoles:", error);
    throw error;
  } finally {
    client.release();
  }
}

export async function assignDocUserRole(
  client: PoolClient,
  requestor: string,
  username: string,
  role: string,
  id: number
): Promise<{ username: string; role: string }> {
  try {
    const docActions = await actions_inner(client, requestor, id);
    if (!docActions.includes("manage_share")) {
      throw new Error(`not permitted to manage share for Document ${id}`);
    }
    if (role === "owner" && !docActions.includes("assign_owner")) {
      throw new Error(`not permitted to assign owner for Document ${id}`);
    }

    await client.query(
      `INSERT INTO document_user_roles (document_id, username, role) VALUES ($1, $2, $3::document_role);`,
      [id, username, role]
    );
    return { username, role };
  } catch (error) {
    console.error("Error in assignDocUserRole:", error);
    throw error;
  }
}

/**
 * Assign a user (`username`) `role` on the document.
 *
 * Requires `requestor` to have the `manage_share` permission on the document.
 * If the specified role is `owner`, the requestor must also have the
 * `assign_owner` permission.
 *
 * ## Oso documentation
 * Demonstrates complex, multi-layered authorization.
 *
 * @throws {Error} If there is a problem with the database connection or the
 * action is not permitted.
 */
export async function assignDocUserRoleForm(
  // Bound parameter because `createUser` is used as a form action.
  p: { requestor: string; id: number },
  _prevState: Result<{ username: string; role: string }> | null,
  formData: FormData
): Promise<Result<{ username: string; role: string }>> {
  const data = {
    username: formData.get("username")! as string,
    role: formData.get("role")! as string,
  };

  const client = await pool.connect();

  try {
    const value = await assignDocUserRole(
      client,
      p.requestor,
      data.username,
      data.role,
      p.id
    );

    return { success: true, value };
  } catch (error) {
    return { success: false, error: stringifyError(error) };
  }
}

/**
 * Update `username`'s role on the specified document to the specified `role`.
 *
 * Requires the `requestor` to have the `manage_share` permission on the
 * document. If the `username` has the `owner` role, or the caller tries to set
 * the user's role to `owner`, `requestor` must also have the `assign_owner`
 * permission.
 *
 * Additionally, the document must have at least one owner after this
 * modification.
 *
 * ## Oso documentation
 * Demonstrates complex, multi-layered authorization.
 *
 * @throws {Error} If there is a problem with the database connection,
 * authorization fails, or the specified user's role is concurrently removed.
 */
export async function updateDocUserRole(
  requestor: string,
  id: number,
  username: string,
  role: string
): Promise<undefined> {
  const client = await pool.connect();
  try {
    const docActions = await actions_inner(client, requestor, id);
    if (!docActions.includes("manage_share")) {
      throw new Error(`not permitted to manage share for Document ${id}`);
    }
    if (role === "owner" && !docActions.includes("assign_owner")) {
      throw new Error(`not permitted to assign owner for Document ${id}`);
    }

    await client.query("BEGIN");
    await client.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;");
    const roleCurr = await client.query<String>(
      `WITH
          current AS (
            SELECT "role", document_id, username
            FROM document_user_roles
            WHERE document_id = $2 AND username = $3
          )
        UPDATE
          document_user_roles AS new
        SET
          "role" = $1::document_role
        FROM
          current
        WHERE
          current.document_id = new.document_id AND current.username = new.username
        RETURNING
          current.role;`,
      [role, id, username]
    );

    if (roleCurr.rowCount != 1) {
      throw new Error(`User ${username} does not have role on Document ${id}`);
    }

    if (roleCurr.rows[0] === "owner") {
      if (!docActions.includes("assign_owner")) {
        throw new Error(`not permitted to change owner of Document ${id}`);
      }

      const owners = await client.query<{ count: number }>(
        `SELECT COUNT(*) FROM document_user_roles WHERE "role" = 'owner' AND document_id = $1;`,
        [id]
      );

      if (owners.rows[0].count < 1) {
        throw new Error(`Document ${id} must have at least one owner`);
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error in updateDocUserRole:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Remove a user's role from a document.
 *
 * Requires `requestor` to have the `manage_share` permission on the document.
 * If the specified user has the `owner` role, the requestor must have the
 * `assign_owner` permission.
 *
 * Additionally, the document must have at least one owner after this
 * modification.
 *
 * ## Oso documentation
 * Demonstrates complex, multi-layered authorization.
 *
 * @throws {Error} If there is a problem with the database connection or
 * authorization fails.
 */
export async function deleteDocUserRole(
  requestor: string,
  id: number,
  username: string
): Promise<undefined> {
  const client = await pool.connect();
  try {
    const docActions = await actions_inner(client, requestor, id);
    if (!docActions.includes("manage_share")) {
      throw new Error(`not permitted to manage share for Document ${id}`);
    }

    await client.query("BEGIN");
    await client.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;");

    const deletedRole = await client.query<{ role: string }>(
      `DELETE FROM document_user_roles WHERE document_id = $1 AND username = $2 RETURNING "role";`,
      [id, username]
    );

    if (
      deletedRole.rows[0].role === "owner" &&
      !docActions.includes("assign_owner")
    ) {
      throw new Error(`not permitted to assign owner for Document ${id}`);
    }

    const ownerCount = await client.query<{ count: number }>(
      `SELECT COUNT(*) FROM document_user_roles WHERE "role" = 'owner' AND document_id = $1;`,
      [id]
    );

    if (ownerCount.rows[0].count < 1) {
      throw new Error(`Document ${id} must have at least one owner`);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error in deleteDocUserRole:", error);
    throw error;
  } finally {
    client.release();
  }
}
