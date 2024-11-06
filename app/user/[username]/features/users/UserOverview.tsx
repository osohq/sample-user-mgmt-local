"use client";

import React, { useEffect, useState } from "react";

import { DatabaseEvents } from "@/lib/dbEvents";
import {
  getReadableUsersWithPermissions,
  UserWOrgPermissions,
} from "@/actions/user";

import OrgCreator from "./OrgCreator";
import UserCreator from "./UserCreator";
import UserManager from "./UserManager";
import { useUsersStore } from "@/lib/users";
import { stringifyError } from "@/lib/result";

interface UserOverview {
  user: UserWOrgPermissions;
}

// Create event signal handlers for tables that can be updated by this
// component.
export const OrgDbEvents = new DatabaseEvents();
export const UserDbEvents = new DatabaseEvents();

const UserOverview: React.FC<UserOverview> = ({ user }) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const setGlobalUsers = useUsersStore((state) => state.setUsers);

  const getUsers = async () => {
    setErrorMessage(null);
    try {
      const fetchedUsers = await getReadableUsersWithPermissions(user.username);
      setGlobalUsers(fetchedUsers);
    } catch (e) {
      setErrorMessage(stringifyError(e));
    }
  };

  useEffect(() => {
    const initUserManager = async () => {
      const unsubscribe = UserDbEvents.subscribe(getUsers);
      try {
        await Promise.all([getUsers()]);
      } catch (e) {
        setErrorMessage(stringifyError(e));
      }
      return unsubscribe;
    };

    initUserManager();
  }, [user]);

  return (
    <div>
      <h2>Users</h2>
      {errorMessage && (
        <div className="error" role="alert">
          {errorMessage}
        </div>
      )}
      {user.createUser && <UserCreator requestor={user.username} />}
      <UserManager requestor={user.username} />
      <OrgCreator requestor={user.username} />
    </div>
  );
};

export default UserOverview;
