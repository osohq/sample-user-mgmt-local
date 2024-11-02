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
  const [users, setUsers] = useState<UsersWActions[]>([]);
  const setGlobalUsers = useUsersStore((state) => state.setUsers);

  // Use a ref to formData so that closures built over it operate over a
  // reference.
  const usersRef = useRef(users);

  // Group users by organization
  const orgUsersMap = React.useMemo(() => {
    usersRef.current = users;
    const map = new Map<string, number[]>();
    users.forEach((user, idx) => {
      const org = user.inner.org;
      if (!map.has(org)) {
        map.set(org, []);
      }
      map.get(org)!.push(idx);
    });
    return map;
  }, [users]);

  // Convenience function to update the form data by reaching out to the
  // database + applying Oso list filtering.
  const getUsers = async () => {
    setErrorMessage(null);
    try {
      const fetchedUsers = await getReadableUsersWithPermissions(requestor);
      setGlobalUsers(fetchedUsers);
      // Filter out the requestor and convert to UsersWActions
      const filteredUsers = fetchedUsers
        .filter(
          (user) =>
            user.username !== requestor && (user.editRole || user.deleteUser)
        )
        .map((user, index) => ({
          inner: user,
          roleCurr: user.role,
          onRoleChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
            user.editRole ? handleRoleChange(e, index) : {},
          onEdit: user.editRole ? () => handleEdit(index) : () => {},
          onDelete: user.deleteUser ? () => handleDelete(index) : () => {},
        }));
      setUsers(filteredUsers);
    } catch (e) {
      setErrorMessage(stringifyError(e));
    }
  };

  useEffect(() => {
    const initUserManager = async () => {
      const unsubscribe = UserDbEvents.subscribe(getUsers);
      try {
        await Promise.all([getUsers(), getOrgRoles().then(setRoles)]);
      } catch (e) {
        setErrorMessage(stringifyError(e));
      }
      return unsubscribe;
    };

    initUserManager();
  }, [requestor]);

  const handleRoleChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
    index: number
  ) => {
    const newFormData = [...usersRef.current];
    newFormData[index].roleCurr = e.target.value;
    setUsers(newFormData);
  };

  // Edit + Delete buttons
  async function handleSingleUserOperation(
    requestor: string,
    index: number,
    operation: "edit" | "delete"
  ) {
    try {
      usersRef.current.forEach((user, thisIndex) => {
        if (user.inner.role !== user.roleCurr && index !== thisIndex) {
          throw new Error(
            `Cannot edit or delete individual users with multiple users' changes pending. Try 'Save changed roles'.`
          );
        }
      });

      const user = usersRef.current[index];
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
