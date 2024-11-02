"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import {
  updateAppointment,
  readAppointments,
  readRecords,
  AppointmentWPermissions,
} from "@/actions/emr";
import { Record as EmrRecord } from "@/lib/relations";
import { stringifyError } from "@/lib/result";
import { useUsersStore } from "@/lib/users";
import { EmrDbEvents } from "./EmrOverview";
import React from "react";

interface ApptManagerProps {
  requestor: string;
  patientFilter?: string;
}

interface RenderableAppt {
  appointment: AppointmentWPermissions;
  record: EmrRecord | null;
}

// Subcomponents
const RecordForm = ({
  requestor,
  appointmentId,
  toggleForm,
}: {
  requestor: string;
  appointmentId: number;
  toggleForm: (id: number) => void;
}) => {
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmrRecord>();

  const recordSubmit = async (data: EmrRecord) => {
    setError(null);
    try {
      await updateAppointment(
        requestor,
        data.appointment_id,
        "completed",
        data
      );
      toggleForm(data.appointment_id);
      EmrDbEvents.emit();
    } catch (error) {
      setError(stringifyError(error));
    }
  };

  return (
    <>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit(recordSubmit)}>
        <div>
          <input
            type="hidden"
            value={appointmentId}
            id="appointment_id"
            {...register("appointment_id", {
              required: true,
              valueAsNumber: true,
            })}
          />
        </div>
        <table>
          <tbody>
            <tr>
              <td>
                <label htmlFor="public_text">Public Text:</label>
              </td>
              <td>
                <textarea
                  id="public_text"
                  {...register("public_text", { required: true })}
                />
                {errors.public_text?.type === "required" && (
                  <div className="error">Public text is required</div>
                )}
              </td>
            </tr>
            <tr>
              <td>
                <label htmlFor="internal_text">Internal Text:</label>
              </td>
              <td>
                <textarea
                  id="internal_text"
                  {...register("internal_text", { required: true })}
                />
                {errors.internal_text?.type === "required" && (
                  <div className="error">Internal text is required</div>
                )}
              </td>
            </tr>
          </tbody>
        </table>
        <button type="submit">Submit</button>
      </form>
    </>
  );
};

const RecordView = ({ record }: { record: EmrRecord }) => (
  <div style={{ border: "1px solid black", padding: "1rem" }}>
    <h3>Public text</h3>
    <p>{record.public_text}</p>
    {record.internal_text && (
      <>
        <h3>Internal text</h3>
        <p>{record.internal_text}</p>
      </>
    )}
  </div>
);

// Main component
const ApptManager = ({ requestor, patientFilter }: ApptManagerProps) => {
  const [error, setError] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<RenderableAppt[]>([]);
  const [visibleForms, setVisibleForms] = useState<Set<number>>(new Set());
  const [visibleRecords, setVisibleRecords] = useState<Set<number>>(new Set());

  const users = useUsersStore((state) => state.users);

  const fetchAppointments = async () => {
    try {
      const [apptsRes, recordsRes] = await Promise.all([
        readAppointments(requestor, patientFilter),
        readRecords(requestor, patientFilter),
      ]);

      const appointmentsMap = new Map<number, RenderableAppt>();

      apptsRes.forEach((appointment) => {
        appointmentsMap.set(appointment.id, { appointment, record: null });
      });

      recordsRes.forEach((record) => {
        const appt = appointmentsMap.get(record.appointment_id);
        if (appt) appt.record = record;
      });

      const sortedAppointments = Array.from(appointmentsMap.values()).sort(
        (a, b) => b.appointment.id - a.appointment.id
      );

      setAppointments(sortedAppointments);
      setError(null);
    } catch (e) {
      setError(stringifyError(e));
    }
  };

  useEffect(() => {
    const unsubscribe = EmrDbEvents.subscribe(fetchAppointments);
    fetchAppointments();
    return unsubscribe;
  }, [requestor, patientFilter]);

  const handleCancelAppointment = async (appointmentId: number) => {
    try {
      await updateAppointment(requestor, appointmentId, "canceled", null);
      EmrDbEvents.emit();
    } catch (error) {
      setError(stringifyError(error));
    }
  };

  const toggleForm = (id: number) => {
    setVisibleForms((prev) => {
      const next = new Set(prev);
      prev.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleRecord = (id: number) => {
    setVisibleRecords((prev) => {
      const next = new Set(prev);
      prev.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>Medical staff</th>
            <th>Patient</th>
            <th>Scheduled at</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map(({ appointment, record }) => (
            <React.Fragment key={appointment.id}>
              <tr>
                <td>{appointment.medical_staff}</td>
                <td>
                  <Link
                    href={`/user/${requestor}/patient/${appointment.patient}`}
                  >
                    {appointment.patient}
                  </Link>
                </td>
                <td>{new Date(appointment.scheduled_at).toLocaleString()}</td>
                <td>{appointment.status}</td>
                <td>
                  {appointment.status === "scheduled" && appointment.cancel && (
                    <button
                      onClick={() => handleCancelAppointment(appointment.id)}
                      disabled={!appointment.cancel}
                    >
                      Cancel
                    </button>
                  )}
                  {appointment.status === "scheduled" &&
                    appointment.complete && (
                      <button
                        onClick={() => toggleForm(appointment.id)}
                        disabled={!appointment.complete}
                      >
                        Complete
                      </button>
                    )}

                  {record && (
                    <button onClick={() => toggleRecord(appointment.id)}>
                      {visibleRecords.has(appointment.id) ? "Hide" : "Show"}{" "}
                      Record
                    </button>
                  )}
                </td>
              </tr>
              {visibleForms.has(appointment.id) && (
                <tr>
                  <td colSpan={5}>
                    <RecordForm
                      requestor={requestor}
                      appointmentId={appointment.id}
                      toggleForm={toggleForm}
                    />
                  </td>
                </tr>
              )}
              {visibleRecords.has(appointment.id) && record && (
                <tr>
                  <td colSpan={5}>
                    <RecordView record={record} />
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ApptManager;
