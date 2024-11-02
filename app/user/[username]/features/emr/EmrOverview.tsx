"use client";

import React from "react";

import { DatabaseEvents } from "@/lib/dbEvents";
import { UserWOrgPermissions } from "@/actions/user";

import ApptScheduler from "./ApptScheduler";
import ApptManager from "./ApptManager";

interface EmrOverviewProps {
  user: UserWOrgPermissions;
}

// Create a listener for any database events to the EMR database.
export const EmrDbEvents = new DatabaseEvents();

const EmrOverview: React.FC<EmrOverviewProps> = ({ user }) => {
  return (
    <div>
      <h1>{user.username} Appts + Records</h1>

      {user.scheduleAppointment && (
        <div>
          <h2>Schedule appointment</h2>
          <ApptScheduler user={user} />
        </div>
      )}

      <h2>Appointments</h2>
      <ApptManager requestor={user.username} />
    </div>
  );
};

export default EmrOverview;
