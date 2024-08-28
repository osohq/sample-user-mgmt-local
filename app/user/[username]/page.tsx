import React from "react";
import { notFound } from "next/navigation";

import { query } from "@/lib/db";
import { oso } from "@/lib/oso";
import { User, Org, Role } from "@/lib/relations";

import {
  CreateUserForm,
  CreateOrgForm,
  ManageUsersForm,
  UsersWPermissions,
} from "./userForms";

interface UserProps {
  params: { username: string };
}

// Render the user's view of the application.
export default async function UserPage({ params }: UserProps) {
  const { username } = params;
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
  const orgs = await query<Org>(assignableOrgs);

  // Determine the users for which this user has `read` permissions. This will
  // form the base of which users this user might be able to manage.
  const readableUsersCond = await oso.listLocal(
    osoUser,
    "read",
    "User",
    "username",
  );

  // Determine the users for which this user has `edit_role` permissions.
  const editableRoleUsersCond = await oso.listLocal(
    osoUser,
    "edit_role",
    "User",
    "username",
  );

  // Determine the users for which this user has `delete` permissions.
  const deleteUsersCond = await oso.listLocal(
    osoUser,
    "delete",
    "User",
    "username",
  );

  // Determine all visible users (`readableUsersCond`), along with whether or
  // not this user has `edit_role` (`editableRoleUsersCond`) or `delete`
  // permissions (`deleteUsersCond`).
  //
  // We inline the `edit_role` and `delete` permissions queries in this query to
  // make fewer calls to the database.
  const usersWPermissions = await query<UsersWPermissions>(
    `SELECT
      username,
      org,
      role,
      ${editableRoleUsersCond} as edit,
      ${deleteUsersCond} as delete
    FROM users
    WHERE ${readableUsersCond}
    ORDER BY username`,
  );

  // Extract this user from the set of all users because we don't want them to
  // be able to edit themselves.
  const userIndex = usersWPermissions.findIndex(
    (user) => user.username === username,
  );

  if (userIndex === -1) {
    return notFound();
  }

  const user: User = usersWPermissions.splice(userIndex, 1)[0];

  // Determine the database's values for `organization_role`.
  const organizationRoles = await query<Role>(
    `SELECT DISTINCT unnest(enum_range(NULL::organization_role)) AS name`,
    [],
  );

  return (
    <div>
      <h1>{user.username} Details</h1>
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
      {/* Only display create user form if this user can assign users to any org */}
      {orgs.length > 0 && (
        <div>
          <h2>Create user</h2>
          <CreateUserForm
            organizations={orgs}
            requestor={user.username}
            roles={organizationRoles}
          />
        </div>
      )}
      {/* Only display visible users on this page if any of them can be modified */}
      {usersWPermissions.some((user) => user.edit || user.delete) && (
        <div>
          <h2>Manage users</h2>
          <ManageUsersForm
            users={usersWPermissions}
            roles={organizationRoles}
            requestor={user.username}
          />
        </div>
      )}
      {/* Global role hack for bootstrapped org to create new organizations */}
      {user.role === "admin" && user.org == "_" && (
        <div>
          <h2>Add organization</h2>
          <CreateOrgForm />
        </div>
      )}
    </div>
  );
}
