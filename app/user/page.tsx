export const dynamic = "force-dynamic";

import Link from "next/link";

import { usersPool, query } from "@/lib/db";
import { User } from "@/lib/relations";

export default async function Home() {
  const users = await query<User>(
    usersPool,
    "SELECT username, org, role::TEXT FROM users ORDER BY username"
  );

  const orgUsersMap: Map<string, User[]> = new Map();
  // Group users by org
  users.forEach((user) => {
    if (!orgUsersMap.has(user.org)) {
      orgUsersMap.set(user.org, []);
    }
    orgUsersMap.get(user.org)!.push(user);
  });

  // Sort the org keys alphabetically
  const sortedOrgs = Array.from(orgUsersMap.keys()).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );

  return (
    <div>
      <h1>Users</h1>
      {sortedOrgs.map((org) => (
        <div key={org}>
          <h4>{org}</h4>
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {orgUsersMap.get(org)!.map((user) => (
                <tr key={user.username}>
                  <td>
                    <Link href={`/user/` + user.username}>{user.username}</Link>
                  </td>
                  <td>{user.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
