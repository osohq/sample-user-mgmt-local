import React from "react";

import { getUserWOrgPermissions, UserWOrgPermissions } from "@/actions/user";
import { stringifyError } from "@/lib/result";

import UserOverview from "./features/users/UserOverview";
import CrmOverview from "./features/crm/CrmOverview";

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
            <div>
              <table>
                <tbody>
                  <tr>
                    <th>Org roles</th>
                    <th>Desc</th>
                  </tr>
                  <tr>
                    <td>admin</td>
                    <td>Org-specific superuser</td>
                  </tr>
                  <tr>
                    <td>analyst</td>
                    <td>
                      Read-only access to all details of all opportunities
                    </td>
                  </tr>
                  <tr>
                    <td>deal_desk</td>
                    <td>
                      Can be assigned opportunities in the{" "}
                      <strong>negotiating</strong> stage.
                    </td>
                  </tr>
                  <tr>
                    <td>sales</td>
                    <td>
                      Can be assigned territories, opportunities. Can manage
                      opportunities within their assigned territories.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="permissions">
              <table>
                <thead>
                  <tr>
                    <th>
                      <strong>Org Permission</strong>
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
                    <td>Create opportunities</td>
                    <td>{user.createOpportunity.toString()}</td>
                    <td>Create new opportunities.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div>
              <UserOverview user={user} />
            </div>
          </div>
          <div id="app" style={{ flex: 1 }}>
            <CrmOverview user={user} />
          </div>
        </div>
      )}
    </div>
  );
}
