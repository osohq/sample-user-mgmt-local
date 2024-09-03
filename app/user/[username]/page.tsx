import React from "react";

import { query } from "@/lib/db";
import { User, Role } from "@/lib/relations";

import { getReadableUsersWithPermissions } from "@/actions/user";

import { CreateUserForm, CreateOrgForm, ManageUsersForm } from "./userForms";

interface UserProps {
  params: { username: string };
}

// Render the user's view of the application.
export default async function UserPage({ params }: UserProps) {
  let errorMessage: string | null = null;
  let user: User | null = null;

  const { username } = params;

  const readableUsersRes = await getReadableUsersWithPermissions(username);
  if (readableUsersRes.success) {
    user = readableUsersRes.value.thisUser;
  } else {
    errorMessage = readableUsersRes.error;
  }

  // Determine the database's values for `organization_role`.
  const organizationRoles = await query<Role>(
    `SELECT DISTINCT unnest(enum_range(NULL::organization_role)) AS name`,
    [],
  );

  return (
    <div>
      {errorMessage && (
        <div className="error" role="alert">
          {errorMessage}
        </div>
      )}

      {!errorMessage && user && (
        <div>
          <h1>{user?.username} Details</h1>
          <table>
            <tbody>
              <tr>
                <th>Org</th>
                <th>Role</th>
              </tr>
              <tr>
                <td>{user.org}</td>
                <td>{user.role}</td>
              </tr>
            </tbody>
          </table>
          <CreateUserForm requestor={user.username} roles={organizationRoles} />
          {/* Global role hack for bootstrapped org to create new organizations */}
          {user.role === "admin" && user.org == "_" && (
            <div>
              <h2>Add organization</h2>
              <CreateOrgForm />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
