"use server";

import { crmPool as pool } from "@/lib/db";
import { authorizeUser, osoCrmMgmt as oso } from "@/lib/oso";
import { Appointment, Record } from "@/lib/relations";
import { Result, stringifyError } from "@/lib/result";
import { typedVar } from "oso-cloud";

export async function scheduleAppointment(
  // Bound parameter because `createUser` is used as a form action.
  p: { requestor: string; org: string },
  _prevState: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  const data = {
    medicalStaff: formData.get("medical_staff")! as string,
    patient: formData.get("patient")! as string,
  };

  const client = await pool.connect();
  try {
    const org = {
      type: "Organization",
      id: p.org,
    };
    const auth = await authorizeUser(
      oso,
      client,
      p.requestor,
      "schedule_appointment",
      org
    );
    if (!auth) {
      return {
        success: false,
        error: `not permitted to create user in Appointment in ${p.org}`,
      };
    }

    await client.query(
      `INSERT INTO appointments (org, medical_staff, patient, scheduled_at, status) VALUES ($1, $2, $3, now(), 'scheduled'::appointment_status);`,
      [p.org, data.medicalStaff, data.patient]
    );

    return { success: true, value: p.requestor };
  } catch (error) {
    return { success: false, error: stringifyError(error) };
  } finally {
    client.release();
  }
}

export async function updateAppointment(
  requestor: string,
  appointment: number,
  status: "completed" | "canceled",
  record: Record | null
) {
  const client = await pool.connect();
  try {
    const appt = {
      type: "Appointment",
      id: appointment.toString(),
    };

    let permission: string = "";
    if (status === "completed") {
      permission = "complete";
    } else if (status === "canceled") {
      permission = "cancel";
    }

    const editAuth = await authorizeUser(
      oso,
      client,
      requestor,
      permission,
      appt
    );
    if (!editAuth) {
      throw new Error(`not permitted to update Appointment ${appointment}`);
    }
    client.query("BEGIN");

    if (record) {
      if (status !== "completed") {
        throw new Error("Cannot add record to non-complete appointment");
      }

      await client.query(
        `INSERT INTO records (appointment_id, internal_text, public_text) VALUES ($1, $2, $3);`,
        [appointment, record.internal_text, record.public_text]
      );
    } else if (status === "completed") {
      throw new Error("Cannot complete appointment without record");
    }

    const res = await client.query(
      `UPDATE appointments SET status = $1::appointment_status WHERE id = $2;`,
      [status, appointment]
    );

    client.query("COMMIT");
  } catch (error) {
    client.query("ROLLBACK");
    console.error("Error in updateAppointment:", error);
    throw error;
  } finally {
    client.release();
  }
}

interface AppointmentActionsAgg extends Appointment {
  actions: string[];
}

export interface AppointmentWPermissions extends Appointment {
  cancel: boolean;
  complete: boolean;
}

export async function readAppointments(
  requestor: string,
  patientFilter?: string
): Promise<AppointmentWPermissions[]> {
  const client = await pool.connect();
  try {
    const user = { type: "User", id: requestor };
    const actionVar = typedVar("String");
    const apptVar = typedVar("Appointment");

    let query = oso.buildQuery(["allow", user, actionVar, apptVar]);
    if (patientFilter) {
      query = query.and([
        "has_relation",
        apptVar,
        "patient",
        { type: "User", id: patientFilter },
      ]);
    }

    const apptActions = await query.evaluateLocalSelect({
      actions: actionVar,
      id: apptVar,
    });

    const apptsWActions = await client.query<AppointmentActionsAgg>(
      `SELECT
          appointments.id,
          org,
          medical_staff,
          patient,
          TO_CHAR(scheduled_at, 'YYYY-MM-DD HH24:MI:SS') AS scheduled_at,
          status,
          actions_per_appt.actions
        FROM (
          -- Get all actions for each user
          SELECT id, array_agg(actions) AS actions
          FROM (
            ${apptActions}
          ) AS appt_actions
          GROUP BY appt_actions.id
        ) AS actions_per_appt
        JOIN appointments ON actions_per_appt.id::INT = appointments.id`
    );

    return apptsWActions.rows.map((appt) => ({
      ...appt,
      cancel: appt.actions.includes("cancel"),
      complete: appt.actions.includes("complete"),
    }));
  } catch (error) {
    console.error("Error in readAppointments:", error);
    throw error;
  } finally {
    client.release();
  }
}

export async function readRecords(
  requestor: string,
  patientFilter?: string
): Promise<Record[]> {
  const client = await pool.connect();
  try {
    const user = { type: "User", id: requestor };
    const actionVar = typedVar("String");
    const recordVar = typedVar("Record");
    let query = oso.buildQuery(["allow", user, actionVar, recordVar]);
    if (patientFilter) {
      const apptVar = typedVar("Appointment");
      query = query
        .and(["has_relation", recordVar, "from", apptVar])
        .and([
          "has_relation",
          apptVar,
          "patient",
          { type: "User", id: patientFilter },
        ]);
    }

    const recordActions = await query.evaluateLocalSelect({
      actions: actionVar,
      id: recordVar,
    });

    const records = await client.query<Record>(
      `SELECT record.id, record.appointment_id, record.public_text, record.internal_text
       FROM (
            SELECT id, array_agg(actions) AS actions
            FROM (
                ${recordActions}
            ) AS record_actions
            GROUP BY record_actions.id
        ) AS actions_per_record
        LEFT JOIN LATERAL (
            SELECT
                id,
                appointment_id,
                public_text,
                CASE
                    WHEN 'read.internal' = ANY (actions_per_record.actions)
                    THEN internal_text
                    ELSE NULL
                END AS internal_text
            FROM records
            WHERE actions_per_record.id::INT = records.id
        ) AS record ON true;`
    );

    return records.rows;
  } catch (error) {
    console.error("Error in readRecords:", error);
    throw error;
  } finally {
    client.release();
  }
}
