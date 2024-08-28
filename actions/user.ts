"use server";

import { pool } from "@/lib/db";
import { authorizeUser, oso } from "@/lib/oso";
import { User } from "@/lib/relations";
import { Result, handleError } from "@/lib/result";

// Create a new user
export async function createUser(
  // Bound parameter because `createUser` is used as a form action.
  p: { requestor: string },
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const data = {
    username: formData.get("username") as string,
    org: formData.get("organization") as string,
    role: formData.get("role") as string,
  };

  const client = await pool.connect();
  try {
    const auth = await authorizeUser(client, p.requestor, "create_user", {
      type: "Organization",
      id: data.org,
    });
    if (!auth) {
      return handleError(
        `not permitted to create user in Organization ${data.org}`,
      );
    }

    await client.query(
      `INSERT INTO users (username, org, role) VALUES ($1, $2, $3::organization_role);`,
      [data.username, data.org, data.role],
    );
    return { success: true, value: null };
  } catch (error) {
    return handleError(error);
  } finally {
    client.release();
  }
}

// Delete a user by username
export async function deleteUser(
  requestor: string,
  username: string,
): Promise<Result<null>> {
  const client = await pool.connect();
  try {
    const auth = await authorizeUser(client, requestor, "delete", {
      type: "User",
      id: username,
    });
    if (!auth) {
      return handleError(`not permitted to delete User ${username}`);
    }

    await client.query(`DELETE FROM users WHERE username = $1;`, [username]);
    return { success: true, value: null };
  } catch (error) {
    return handleError(error);
  } finally {
    client.release();
  }
}

// Save multiple user assignments in bulk
export async function editUsersRoleByUsername(
  requestor: string,
  updates: User[],
): Promise<Result<null>> {
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
      "users.username",
    );

    const queryText = `
        UPDATE users
        SET role = v.role::organization_role
        FROM (VALUES 
          ${updates.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(", ")}
        ) AS v(username, role)
        WHERE users.username = v.username AND ${editRoleAuthorized};
      `;

    const userFields: string[] = updates.flatMap((user) => [
      user.username,
      user.role,
    ]);

    await client.query("BEGIN");
    const r = await client.query(queryText, userFields);

    // Check the affected row count, which is our signal that there is a
    // discrepancy between the number of users submitted and the number of users
    // that passed the condition expressed by `editRoleAuthorized`.
    if (r.rowCount !== updates.length) {
      // If these numbers do not align, abort the operation.
      client.query("ROLLBACK");
      return handleError(`not permitted to edit role of all submitted users`);
    } else {
      // If these numbers aligned things are good.
      client.query("COMMIT");
      return { success: true, value: null };
    }
  } catch (error) {
    return handleError(error);
  } finally {
    client.release();
  }
}
