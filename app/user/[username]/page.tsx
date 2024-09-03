import React from "react";

import { User } from "@/lib/relations";

import { getReadableUsersWithPermissions } from "@/actions/user";

import { CreateOrgForm } from "./userForms";

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
          <div>
            <CreateOrgForm requestor={user.username} />
          </div>
        </div>
      )}
    </div>
  );
}
