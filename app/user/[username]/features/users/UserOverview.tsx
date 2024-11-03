"use client";

import React from "react";

import { DatabaseEvents } from "@/lib/dbEvents";
import { UserWOrgPermissions } from "@/actions/user";

import OrgCreator from "./OrgCreator";
import UserCreator from "./UserCreator";
import UserManager from "./UserManager";

interface UserOverview {
  user: UserWOrgPermissions;
}

// Create event signal handlers for tables that can be updated by this
// component.
export const OrgDbEvents = new DatabaseEvents();
export const UserDbEvents = new DatabaseEvents();

const UserOverview: React.FC<UserOverview> = ({ user }) => {
  return (
    <div>
      {user.createUser && (
        <>
          <h2>User management</h2>
          <UserCreator requestor={user.username} />
          <UserManager requestor={user.username} />
        </>
      )}

      <OrgCreator requestor={user.username} />
    </div>
  );
};

export default UserOverview;
