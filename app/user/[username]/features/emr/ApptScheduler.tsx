"use client";

import React, { useEffect, useState } from "react";
import { useFormState } from "react-dom";

import { scheduleAppointment } from "@/actions/emr";
import { User } from "@/lib/relations";
import { useUsersStore, UsersState } from "@/lib/users";

import { EmrDbEvents } from "./EmrOverview";

interface ApptSchedulerProps {
  user: User;
}

type UserRole = "medical_staff" | "patient";

const filterUsersByRole = (users: User[], role: UserRole) =>
  users.filter((user) => user.role === role).map((user) => user.username);

const ApptUserField = ({
  name,
  label,
  options,
}: {
  name: UserRole;
  label: string;
  options: string[];
}) => (
  <tr>
    <td>
      <label htmlFor={name}>{label}</label>
    </td>
    <td>
      <select id={name} name={name} required>
        {options.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    </td>
  </tr>
);

const ApptScheduler: React.FC<ApptSchedulerProps> = ({ user }) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const users = useUsersStore((state: UsersState) => state.users);

  const scheduleAppointmentWRequestor = scheduleAppointment.bind(null, {
    requestor: user.username,
    org: user.org,
  });
  const [scheduleApptState, scheduleApptAction] = useFormState(
    scheduleAppointmentWRequestor,
    null
  );

  useEffect(() => {
    // Narrow from null
    if (!scheduleApptState) {
      return;
    }

    if (scheduleApptState.success) {
      setErrorMessage(null);
      EmrDbEvents.emit();
    } else if (!scheduleApptState.success) {
      setErrorMessage(scheduleApptState.error);
    }
  }, [scheduleApptState]);

  const medicalStaffOptions = filterUsersByRole(users, "medical_staff");
  const patientOptions = filterUsersByRole(users, "patient");

  return (
    <div>
      {errorMessage && (
        <div className="error" role="alert">
          {errorMessage}
        </div>
      )}

      <form action={scheduleApptAction}>
        <div>
          <table>
            <tbody>
              <ApptUserField
                name="medical_staff"
                label="Medical staff"
                options={medicalStaffOptions}
              />
              <ApptUserField
                name="patient"
                label="Patient"
                options={patientOptions}
              />
            </tbody>
          </table>
        </div>
        <button type="submit">Submit</button>
      </form>
    </div>
  );
};

export default ApptScheduler;
