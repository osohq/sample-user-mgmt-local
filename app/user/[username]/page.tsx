import React from "react";
import { notFound } from "next/navigation";

import { query } from "@/lib/db";
import { User, Org, Role } from "@/lib/relations";
import { oso } from "@/lib/oso";

import {
  CreateUserForm,
  CreateOrgForm,
  ManageUsersForm,
  UsersWPermissions,
} from "./userForms";

interface UserProps {
  params: { username: string };
}

export default async function UserPage({ params }: UserProps) {
  const { username } = params;
  const osoUser = { type: "User", id: username };

  const assignableOrgCond = await oso.listLocal(
    osoUser,
    "create_user",
    "Organization",
    "name",
  );

  const assignableOrgs = `SELECT organizations.name FROM organizations WHERE ${assignableOrgCond}`;
  const orgs = await query<Org>(assignableOrgs);

  const readableUsersCond = await oso.listLocal(
    osoUser,
    "read",
    "User",
    "username",
  );

  const editableRoleUsersCond = await oso.listLocal(
    osoUser,
    "edit_role",
    "User",
    "username",
  );

  const deleteUsersCond = await oso.listLocal(
    osoUser,
    "edit_role",
    "User",
    "username",
  );

  const organizationRoles = await query<Role>(
    `SELECT DISTINCT unnest(enum_range(NULL::organization_role)) AS name`,
    [],
  );

  const usersWPermissions = await query<UsersWPermissions>(
    `SELECT
      username,
      org,
      role,
      ${editableRoleUsersCond} as edit,
      ${deleteUsersCond} as delete
    FROM users
    WHERE ${readableUsersCond}`,
  );

  const userIndex = usersWPermissions.findIndex(
    (user) => user.username === username,
  );

  if (userIndex === -1) {
    return notFound();
  }

  // Remove this user and use its details.
  const user: User = usersWPermissions.splice(userIndex, 1)[0];
  usersWPermissions.sort((a, b) => a.username.localeCompare(b.username));

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
      {orgs.length > 0 && (
        <div>
          <h2>Create user</h2>
          <CreateUserForm organizations={orgs} roles={organizationRoles} />
        </div>
      )}
      {usersWPermissions.some((user) => user.edit || user.delete) && (
        <div>
          <h2>Manage users</h2>
          <ManageUsersForm
            users={usersWPermissions}
            roles={organizationRoles}
          />
        </div>
      )}
      {user.role === "admin" && user.org == "_" && (
        <div>
          <h2>Add organization</h2>
          <CreateOrgForm />
        </div>
      )}
    </div>
  );
}
