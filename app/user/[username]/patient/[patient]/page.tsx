import React from "react";

import ApptManager from "../../features/emr/ApptManager";
import Link from "next/link";

interface PatientViewProps {
  params: { username: string; patient: string };
}

/**
 * Render the user's view of the application.
 */
export default async function PatientView({ params }: PatientViewProps) {
  const { patient, username } = params;
  return (
    <div>
      <Link href={`/user/${username}`}>&lt; Home</Link>

      <h2>
        {username}'s view of {patient}'s patient records
      </h2>

      <ApptManager requestor={username} patientFilter={patient} />
    </div>
  );
}
