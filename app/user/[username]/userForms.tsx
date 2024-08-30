"use client";

import React, { useState, useEffect } from "react";
import { useFormStatus, useFormState } from "react-dom";
import Link from "next/link";

import { User, Org, Role } from "@/lib/relations";
import { Result } from "@/lib/result";
import { createUser, deleteUser, updateUsersByUsername } from "@/actions/user";
import { createOrg } from "@/actions/org";

function SubmitButton({ action }: { action: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? "Saving..." : action}
    </button>
  );
}

interface CreateUserFormProps {
  organizations: Org[];
  roles: Role[];
}

export function CreateUserForm({ organizations, roles }: CreateUserFormProps) {
  const [formState, formAction] = useFormState(createUser, null);
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
          <label htmlFor="username">Username:</label>
          <input
            id="username"
            type="text"
            name="username"
            required
          />
        </div>
        <div>
          <label htmlFor="organization">Organization:</label>
          <select
            id="organization"
            name="organization"
            required
          >
            {organizations.map((org) => (
              <option key={org.name} value={org.name}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="role">Role:</label>
          <select
            id="role"
            name="role"
            required
          >
            {roles.map((role) => (
              <option key={role.name} value={role.name}>
                {role.name}
              </option>
            ))}
          </select>
        </div>
        <SubmitButton action="Create user" />
      </form>
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
          <input
            id="orgName"
            type="text"
            name="orgName"
            required
          />
        </div>
        <SubmitButton action="Add org" />
      </form>
    </div>
  );
}

export interface UsersWPermissions {
  username: string;
  org: string;
  role: string;
  edit: boolean;
  delete: boolean;
}

interface ManageUsersFormProps {
  users: UsersWPermissions[];
  roles: Role[];
}

interface FormData {
  username: string;
  org: string;
  roleOriginal: string;
  roleCurr: string;
  edit: boolean;
  delete: boolean;
  onRoleChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const ManageUsersForm: React.FC<ManageUsersFormProps> = ({
  users,
  roles,
}) => {
  // Manage data for all forms as a single array.
  const [formData, setFormData] = useState<FormData[]>(
    users.map((user, index) => ({
      username: user.username,
      org: user.org,
      roleOriginal: user.role,
      roleCurr: user.role,
      edit: user.edit,
      delete: user.delete,
      onRoleChange: (e) => handleRoleChange(e, index),
      onEdit: () => handleEdit(index),
      onDelete: () => handleDelete(index),
    })),
  );

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Group users by org
  const orgUsersMap: Map<string, FormData[]> = new Map();
  formData.forEach((user) => {
    if (!orgUsersMap.has(user.org)) {
      orgUsersMap.set(user.org, []);
    }
    orgUsersMap.get(user.org)!.push(user);
  });

  // Sort the org keys alphabetically
  const sortedOrgs = Array.from(orgUsersMap.keys()).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  );

  const handleRoleChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
    index: number,
  ) => {
    const newFormData = [...formData];
    newFormData[index].roleCurr = e.target.value;
    setFormData(newFormData);
  };

  // Ensure that there is only one pending change when modifying a single user.
  function ensureOnePendingChange(exceptIndex: number): void {
    formData.forEach((formData, index) => {
      if (
        formData.roleOriginal !== formData.roleCurr &&
        exceptIndex !== index
      ) {
        throw new Error(
          `Cannot edit or delete individual users with multiple users' changes pending. Try 'Save all'.`,
        );
      }
    });
  }

  // Edit + Delete buttons
  type Operation = "edit" | "delete";

  async function handleSingleUserOperation(
    index: number,
    operation: Operation,
  ) {
    try {
      ensureOnePendingChange(index);
      const user = formData[index];
      let r: Result<null>;
      if (operation === "edit") {
        r = await updateUsersByUsername([
          { username: user.username, role: user.roleCurr, org: user.org },
        ]);
      } else {
        r = await deleteUser(user.username);
      }

      if (r.success) {
        // Refresh the page if the form submission was successful to re-fetch new
        // data.
        window.location.reload();
      } else {
        setErrorMessage(r.error);
      }
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unknown error");
      }
    }
  }

  const handleEdit = (index: number) =>
    handleSingleUserOperation(index, "edit");
  const handleDelete = (index: number) =>
    handleSingleUserOperation(index, "delete");

  // Save all button
  const handleSaveAll = async () => {
    const updatedUsers: User[] = formData.map((user) => ({
      username: user.username,
      org: user.org,
      role: user.roleCurr,
    }));
    const r = await updateUsersByUsername(updatedUsers);
    if (r.success) {
      // Refresh the page if the form submission was successful to re-fetch new
      // data.
      window.location.reload();
    } else {
      setErrorMessage(r.error);
    }
  };

  return (
    <div>
      {errorMessage && (
        <div className="error" role="alert">
          {errorMessage}
        </div>
      )}
      <button onClick={handleSaveAll}>Save all</button>
      {sortedOrgs.map((org) => (
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
              {orgUsersMap.get(org)!.map((user) => (
                <tr
                  key={user.username}
                  // Highlight all changed values in yellow to indicate to user
                  // their pending changes.
                  style={{
                    backgroundColor:
                      user.roleOriginal === user.roleCurr ? "" : "yellow",
                  }}
                >
                  <td>
                    <Link href={`/user/` + user.username}>{user.username}</Link>
                  </td>
                  <td>
                    {user.edit ? (
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
                    <button onClick={user.onEdit} disabled={!user.edit}>
                      Edit
                    </button>
                  </td>
                  <td>
                    <button onClick={user.onDelete} disabled={!user.delete}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
};
