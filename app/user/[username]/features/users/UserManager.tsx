"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";

import { User, Role } from "@/lib/relations";
import { stringifyError } from "@/lib/result";
import { useUsersStore } from "@/lib/users";

import { getOrgRoles } from "@/actions/org";
import {
  deleteUser,
  editUsersRoleByUsername,
  ReadableUser,
  getReadableUsersWithPermissions,
} from "@/actions/user";

import { UserDbEvents } from "./UserOverview";

interface UserManagerProps {
  requestor: string;
}

interface UsersWActions {
  inner: ReadableUser;
  roleCurr: string;
  onRoleChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Provides a component to manage permitted users.
 *
 * This component receives users from `UserCreator` (`usersIn`).
 */
const UserManager: React.FC<UserManagerProps> = ({ requestor }) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [roles, setRoles] = useState<Role[]>([]);

  // Convert `ReadableUser[]` to `FormData[]`, filtering out any users that
  // the requestor has neither edit nor delete permissions on.
  function usersActionsFromPermissions(users: ReadableUser[]): UsersWActions[] {
    return (
      users
        // Filter out users without edit or delete permissions
        .filter((user) => user.editRole || user.deleteUser)
        .map((user, index) => ({
          inner: user,
          roleCurr: user.role,
          onRoleChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
            user.editRole ? handleRoleChange(e, index) : {},
          onEdit: user.editRole ? () => handleEdit(index) : () => {},
          onDelete: user.deleteUser ? () => handleDelete(index) : () => {},
        }))
    );
  }

  const setGlobalUsers = useUsersStore((state) => state.setUsers);
  const [users, setUsers] = useState<UsersWActions[]>([]);

  // Convenience function to update the form data by reaching out to the
  // database + applying Oso list filtering.
  async function getUsers() {
    try {
      const users = await getReadableUsersWithPermissions(requestor);
      setGlobalUsers(users);
      // Don't let the user manage their own permissions.
      const filteredUsers = users.filter((user) => user.username !== requestor);
      setUsers(usersActionsFromPermissions(filteredUsers));
    } catch (e) {
      setErrorMessage(stringifyError(e));
    }
  }

  const [orgUsersMap, setOrgUsersMap] = useState<Map<string, number[]>>(
    new Map()
  );

  // Use a ref to formData so that closures built over it operate over a
  // reference.
  const usersRef = useRef(users);

  // Whenever users change, update all dependent state.
  useEffect(() => {
    // Keep the ref updated with the latest state
    usersRef.current = users;

    // Ensure the map of orgs to users is consistent.
    const map: Map<string, number[]> = new Map();
    users.map((user, index) => {
      if (!map.has(user.inner.org)) {
        map.set(user.inner.org, []);
      }
      map.get(user.inner.org)!.push(index);
    });
    setOrgUsersMap(map);

    // Reset error message.
    setErrorMessage(null);
  }, [users]);

  useEffect(() => {
    const initUserManager = async () => {
      const unsubscribe = UserDbEvents.subscribe(() => getUsers());
      try {
        getUsers();

        // Determine the database's values for `organization_role`.
        const orgRoles = await getOrgRoles();
        setRoles(orgRoles);
        return unsubscribe;
      } catch (e) {
        setErrorMessage(stringifyError(e));
      }
    };
    initUserManager();
  }, []);

  const handleRoleChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
    index: number
  ) => {
    const newFormData = [...usersRef.current];
    newFormData[index].roleCurr = e.target.value;
    setUsers(newFormData);
  };

  // Ensure that there is only one pending change when modifying a single user.
  function ensureOnePendingChange(exceptIndex: number): void {
    usersRef.current.forEach((user, index) => {
      if (user.inner.role !== user.roleCurr && exceptIndex !== index) {
        throw new Error(
          `Cannot edit or delete individual users with multiple users' changes pending. Try 'Save changed roles'.`
        );
      }
    });
  }

  // Edit + Delete buttons
  async function handleSingleUserOperation(
    requestor: string,
    index: number,
    operation: "edit" | "delete"
  ) {
    try {
      ensureOnePendingChange(index);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unknown error");
      return;
    }
    const user = usersRef.current[index];
    try {
      operation === "edit"
        ? await editUsersRoleByUsername(requestor, [
            {
              username: user.inner.username,
              role: user.roleCurr,
              org: user.inner.org,
            },
          ])
        : await deleteUser(requestor, user.inner.username);
      UserDbEvents.emit();
    } catch (e) {
      setErrorMessage(stringifyError(e));
    }
  }

  const handleEdit = (index: number) =>
    handleSingleUserOperation(requestor, index, "edit");
  const handleDelete = (index: number) =>
    handleSingleUserOperation(requestor, index, "delete");

  // Save changed roles button
  const handleSaveUpdatedRoles = async () => {
    const updatedUsers: User[] = usersRef.current
      // Only update roles that have changed.
      .filter((user) => user.roleCurr !== user.inner.role)
      .map((user) => ({
        username: user.inner.username,
        org: user.inner.org,
        role: user.roleCurr,
      }));

    try {
      await editUsersRoleByUsername(requestor, updatedUsers);
      UserDbEvents.emit();
    } catch (e) {
      setErrorMessage(stringifyError(e));
    }
  };

  return (
    <div>
      {/* Only display table if there are orgs */}
      {Boolean(orgUsersMap.size) && (
        <div>
          <h3>Manage users</h3>
          {errorMessage && (
            <div className="error" role="alert">
              {errorMessage}
            </div>
          )}
          <button onClick={handleSaveUpdatedRoles}>Save changed roles</button>
          {Array.from(orgUsersMap.keys())
            .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
            .map((org) => (
              <div key={org}>
                {/* Show org if there are multiple. */}
                {orgUsersMap.size > 1 && <h3>{org}</h3>}
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th></th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {orgUsersMap.get(org)!.map((userIndex) => {
                      const user = usersRef.current[userIndex];

                      return (
                        <tr
                          key={user.inner.username}
                          // Highlight all changed values in yellow to indicate to user
                          // their pending changes.
                          style={{
                            backgroundColor:
                              user.inner.role === user.roleCurr ? "" : "yellow",
                          }}
                        >
                          <td>
                            <Link href={`/user/` + user.inner.username}>
                              {user.inner.username}
                            </Link>
                          </td>
                          <td>
                            {/* Allow selecting a role iff requestor has editRole */}
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
                              <p>{user.roleCurr}</p>
                            )}
                          </td>
                          <td>
                            <button
                              onClick={user.onEdit}
                              disabled={!user.inner.editRole}
                            >
                              Edit
                            </button>
                          </td>
                          <td>
                            <button
                              onClick={user.onDelete}
                              disabled={!user.inner.deleteUser}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default UserManager;
