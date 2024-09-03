"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useFormStatus, useFormState } from "react-dom";
import Link from "next/link";

import { User, Org, Role } from "@/lib/relations";
import {
  createUser,
  deleteUser,
  editUsersRoleByUsername,
  UsersWPermissions,
  getReadableUsersWithPermissions,
} from "@/actions/user";
import { createOrg, getCreateUserOrgs } from "@/actions/org";

function SubmitButton({ action }: { action: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? "Saving..." : action}
    </button>
  );
}

interface CreateUserFormProps {
  requestor: string;
  roles: Role[];
}

export function CreateUserForm({ requestor, roles }: CreateUserFormProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // We need to provide the username of the user creating the new user to ensure
  // they're permitted to do so.
  const createUserWithCreator = createUser.bind(null, { requestor });
  const [formState, formAction] = useFormState(createUserWithCreator, null);
  // Triggers re-build of form to reset fields.
  const [formKey, setFormKey] = useState<number>(0);

  // Organizations that user can create new users on.
  const [orgs, setOrgs] = useState<Org[]>([]);
  // Users to propagate down to the manage users component.
  const [users, setUsers] = useState<UsersWPermissions[]>([]);

  // Convenience function to update the form data by reaching out to the
  // database + applying Oso list filtering.
  async function updateUsers(requestor: string) {
    const usersRes = await getReadableUsersWithPermissions(requestor);
    if (usersRes.success) {
      setUsers(usersRes.value.users);
    } else {
      setErrorMessage(usersRes.error);
    }
  }

  // Get orgs + users on initial load
  useEffect(() => {
    const initializeCreateUserFormState = async () => {
      const orgsResult = await getCreateUserOrgs(requestor);
      if (orgsResult.success) {
        setOrgs(orgsResult.value);
        updateUsers(requestor);
      } else if (errorMessage === null) {
        setErrorMessage(orgsResult.error);
      }
    };
    initializeCreateUserFormState();
  }, []);

  // Update users whenever new user created.
  useEffect(() => {
    if (formState?.success) {
      // Refresh the page if the form submission was successful to re-fetch new
      // data.
      updateUsers(requestor);
      // Re-render form after successful submission.
      setFormKey((prevKey) => prevKey + 1);
      setErrorMessage(null);
    } else if (!formState?.success) {
      setErrorMessage(formState?.error as string);
    }
  }, [formState]);

  return (
    <div>
      {Boolean(orgs.length) && <h2>Create Users</h2>}
      {errorMessage && (
        <div className="error" role="alert">
          {errorMessage}
        </div>
      )}
      {Boolean(orgs.length) && (
        <form action={formAction} key={formKey}>
          <div>
            <label htmlFor="username">Username:</label>
            <input id="username" type="text" name="username" required />
          </div>
          <div>
            <label htmlFor="organization">Organization:</label>
            <select id="organization" name="organization" required>
              {orgs.map((org) => (
                <option key={org.name} value={org.name}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="role">Role:</label>
            <select id="role" name="role" required>
              {roles.map((role) => (
                <option key={role.name} value={role.name}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
          <SubmitButton action="Create user" />
        </form>
      )}
      <ManageUsersForm requestor={requestor} usersIn={users} roles={roles} />
    </div>
  );
}

export function CreateOrgForm() {
  const [formState, formAction] = useFormState(createOrg, null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (formState?.success) {
      // Refresh the page if the form submission was successful to re-fetch new
      // data.
      window.location.reload();
    } else if (!formState?.success) {
      setErrorMessage(formState?.error as string);
    }
  }, [formState?.success]);

  return (
    <div>
      {errorMessage && (
        <div className="error" role="alert">
          {errorMessage}
        </div>
      )}
      <form action={formAction}>
        <div>
          <label htmlFor="orgName">Name:</label>
          <input id="orgName" type="text" name="orgName" required />
        </div>
        <SubmitButton action="Add org" />
      </form>
    </div>
  );
}

interface ManageUsersFormProps {
  requestor: string;
  usersIn: UsersWPermissions[];
  roles: Role[];
}

interface UsersWActions {
  inner: UsersWPermissions;
  roleCurr: string;
  onRoleChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const ManageUsersForm: React.FC<ManageUsersFormProps> = ({
  requestor,
  usersIn,
  roles,
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Convert `UsersWPermissions[]` to `FormData[]`, filtering out any users that
  // the requestor has neither edit nor delete permissions on.
  function usersActionsFromPermissions(
    users: UsersWPermissions[],
  ): UsersWActions[] {
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

  const [users, setUsers] = useState<UsersWActions[]>(
    usersActionsFromPermissions(usersIn),
  );
  const [orgUsersMap, setOrgUsersMap] = useState<Map<string, number[]>>(
    new Map(),
  );

  // Use a ref to formData so that closures built over it operate over a
  // reference.
  const usersRef = useRef(users);

  // Update users whenever usersIn changes.
  useEffect(() => {
    setUsers(usersActionsFromPermissions(usersIn));
  }, [usersIn]);

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

  // Convenience function to update the form data by reaching out to the
  // database + applying Oso list filtering.
  async function updateUsers(requestor: string) {
    const usersRes = await getReadableUsersWithPermissions(requestor);
    if (usersRes.success) {
      setUsers(usersActionsFromPermissions(usersRes.value.users));
    } else {
      setErrorMessage(usersRes.error);
    }
  }

  const handleRoleChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
    index: number,
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
          `Cannot edit or delete individual users with multiple users' changes pending. Try 'Save changed roles'.`,
        );
      }
    });
  }

  // Edit + Delete buttons
  type Operation = "edit" | "delete";

  async function handleSingleUserOperation(
    requestor: string,
    index: number,
    operation: Operation,
  ) {
    try {
      ensureOnePendingChange(index);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unknown error");
      return;
    }

    const user = usersRef.current[index];
    const result =
      operation === "edit"
        ? await editUsersRoleByUsername(requestor, [
            {
              username: user.inner.username,
              role: user.roleCurr,
              org: user.inner.org,
            },
          ])
        : await deleteUser(requestor, user.inner.username);

    if (result.success) {
      await updateUsers(requestor);
    } else {
      setErrorMessage(result.error);
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

    const r = await editUsersRoleByUsername(requestor, updatedUsers);
    if (r.success) {
      await updateUsers(requestor);
    } else {
      setErrorMessage(r.error);
    }
  };

  return (
    <div>
      {/* Only display table if there are orgs */}
      {Boolean(orgUsersMap.size) && (
        <div>
          <h2>Manage users</h2>
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
                <h3>{org}</h3>
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
