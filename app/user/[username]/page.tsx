import React from "react";

import { getUserWOrgPermissions, UserWOrgPermissions } from "@/actions/user";
import { stringifyError } from "@/lib/result";

import UserOverview from "./features/users/UserOverview";
import EmrOverview from "./features/emr/EmrOverview";

interface UserProps {
  params: { username: string };
}

/**
 * Render the user's view of the application.
 */
export default async function UserPage({ params }: UserProps) {
  let errorMessage: string | null = null;
  let user: UserWOrgPermissions | null = null;

  const { username } = params;

  try {
    user = await getUserWOrgPermissions(username);
  } catch (e) {
    errorMessage = stringifyError(e);
  }

  return (
    <div>
      {errorMessage && (
        <div className="error" role="alert">
          {errorMessage}
        </div>
      )}

      {!errorMessage && user && (
        <div
          id="parent"
          style={{ display: "flex", justifyContent: "space-between" }}
        >
          <div id="user_mgmt" style={{ flex: 1 }}>
            <h2>{user.username} Home</h2>
            <hr />
            <h2>Org Details</h2>
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
            <div className="permissions">
              <table>
                <thead>
                  <tr>
                    <th>
                      <strong>Permission</strong>
                    </th>
                    <th>
                      <strong>Value</strong>
                    </th>
                    <th>
                      <strong>Lets this user...</strong>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Read</td>
                    <td>{user.readOrg.toString()}</td>
                    <td>
                      Read users from their parent org, <code>{user.org}</code>.
                    </td>
                  </tr>
                  <tr>
                    <td>Create user</td>
                    <td>{user.createUser.toString()}</td>
                    <td>Create new users.</td>
                  </tr>
                  <tr>
                    <td>Schedule appointment</td>
                    <td>{user.scheduleAppointment.toString()}</td>
                    <td>Schedule new appointments.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div>
              <UserOverview user={user} />
            </div>
          </div>
          <div id="app" style={{ flex: 1 }}>
            <EmrOverview user={user} />
          </div>
        </div>
      )}
    </div>
  );
}
