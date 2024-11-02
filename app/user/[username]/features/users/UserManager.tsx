"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

import { User, Role } from "@/lib/relations";
import { stringifyError } from "@/lib/result";
import { useUsersStore } from "@/lib/users";

import { getOrgRoles } from "@/actions/org";
import { editUsersRoleByUsername, ReadableUser } from "@/actions/user";

import { UserDbEvents } from "./UserOverview";

type UserOperation = "edit" | "delete";

interface UserManagerProps {
  requestor: string;
}

interface UsersWActions {
  inner: ReadableUser;
  roleCurr: Role["name"];
  onRoleChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onEdit: () => void;
}

const UserTable: React.FC<{
  org: string;
  userIndices: number[];
  users: UsersWActions[];
  roles: Role[];
}> = ({ org, userIndices, users, roles }) => (
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Role</th>
        <th>Manager</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      {userIndices.map((userIndex) => {
        const user = users[userIndex];
        const hasChanges = user.inner.role !== user.roleCurr;

        return (
          <tr
            key={user.inner.username}
            style={{ backgroundColor: hasChanges ? "yellow" : undefined }}
          >
            <td>
              <Link href={`/user/` + user.inner.username}>
                {user.inner.username}
              </Link>
            </td>
            <td>
              {user.inner.editRole ? (
                <select
                  name="role"
                  value={user.roleCurr}
                  onChange={(e) => user.onRoleChange(e)}
                >
                  {roles.map((role) => (
                    <option key={role.name} value={role.name}>
                      {role.name}
                    </option>
                  ))}
                </select>
              ) : (
                <>{user.roleCurr}</>
              )}
            </td>
            <td>{user.inner.manager}</td>
            <td>
              {user.inner.editRole && (
                <button onClick={user.onEdit}>Edit role</button>
              )}
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

/**
 * Provides a component to manage permitted users.
 */
const UserManager: React.FC<UserManagerProps> = ({ requestor }) => {
  const [state, setState] = useState<{
    errorMessage: string | null;
    roles: Role[];
    users: UsersWActions[];
  }>({
    errorMessage: null,
    roles: [],
    users: [],
  });
  const globalUsers = useUsersStore((state) => state.users);

  // Use a ref to formData so that closures built over it operate over a
  // reference.
  const usersRef = useRef(state.users);

  // Group users by organization
  const orgUsersMap = React.useMemo(() => {
    usersRef.current = state.users;
    const map = new Map<string, number[]>();
    state.users.forEach((user, idx) => {
      const org = user.inner.org;
      if (!map.has(org)) {
        map.set(org, []);
      }
      map.get(org)!.push(idx);
    });
    return map;
  }, [state.users]);

  useEffect(() => {
    const initUserManager = async () => {
      try {
        const roles = await getOrgRoles();
        const users = globalUsers
          .filter((user) => user.username !== requestor)
          .map((user, index) => ({
            inner: user,
            roleCurr: user.role,
            onRoleChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
              user.editRole ? handleRoleChange(e, index) : {},
            onEdit: user.editRole ? () => handleEdit(index) : () => {},
          }));

        setState((prev) => ({ roles, users, errorMessage: null }));
      } catch (e) {
        setState((prev) => ({ ...prev, errorMessage: stringifyError(e) }));
      }
    };

    initUserManager();
  }, [globalUsers, requestor]);

  const handleRoleChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
    index: number
  ) => {
    const newFormData = [...usersRef.current];
    newFormData[index].roleCurr = e.target.value;
    setState((prev) => ({ ...prev, users: newFormData }));
  };

  const handleSingleUserOperation = useCallback(
    async (index: number, operation: UserOperation) => {
      try {
        const users = usersRef.current;
        // Check for pending changes
        const hasPendingChanges = users.some(
          (user, i) => i !== index && user.inner.role !== user.roleCurr
        );

        if (hasPendingChanges) {
          throw new Error(
            'Cannot edit or delete individual users with multiple users\' changes pending. Try "Save changed roles".'
          );
        }

        const user = users[index];
        if (operation === "edit") {
          await editUsersRoleByUsername(requestor, [
            {
              username: user.inner.username,
              role: user.roleCurr,
              org: user.inner.org,
              manager: user.inner.manager,
            },
          ]);
        }

        UserDbEvents.emit();
      } catch (e) {
        setState((prev) => ({ ...prev, errorMessage: stringifyError(e) }));
      }
    },
    [requestor]
  );

  const handleEdit = (index: number) =>
    handleSingleUserOperation(index, "edit");
  const handleDelete = (index: number) =>
    handleSingleUserOperation(index, "delete");

  // Save changed roles button
  const handleSaveUpdatedRoles = async () => {
    const updatedUsers: User[] = usersRef.current
      // Only update roles that have changed.
      .filter((user) => user.roleCurr !== user.inner.role)
      .map((user) => ({
        username: user.inner.username,
        org: user.inner.org,
        role: user.roleCurr,
        manager: user.inner.manager,
      }));

    try {
      await editUsersRoleByUsername(requestor, updatedUsers);
      UserDbEvents.emit();
    } catch (e) {
      setState((prev) => ({ ...prev, errorMessage: stringifyError(e) }));
    }
  };

  return (
    <div>
      {Boolean(orgUsersMap.size) && (
        <div>
          <h3>Visible users</h3>
          {state.errorMessage && (
            <div className="error" role="alert">
              {state.errorMessage}
            </div>
          )}

          {usersRef.current.some((user) => user.inner.editRole) && (
            <button onClick={handleSaveUpdatedRoles} className="primary-button">
              Save changed roles
            </button>
          )}

          {Array.from(orgUsersMap.keys())
            .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
            .map((org) => (
              <div key={org} className="org-section">
                {orgUsersMap.size > 1 && <h3>{org} org</h3>}
                <UserTable
                  org={org}
                  userIndices={orgUsersMap.get(org) || []}
                  users={usersRef.current}
                  roles={state.roles}
                />
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default UserManager;
