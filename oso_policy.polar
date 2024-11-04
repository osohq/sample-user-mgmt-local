# Our applications are meant to demonstrate multi-tenancy, and we will separate
# tenants into separate, distinct `Organization`s.
#
# `Organization` permissions are meant to rely on standard RBAC, which is why we
# only need to use Polar's shorthand rules.
resource Organization {
    # Roles which users may have within an organization.
    roles = ["medical_staff", "administrative_staff", "patient"];

    # Actions which users may try to take on an organization.
    permissions = ["read", "create_user", "schedule_appointment"];

    # RBAC
    "read" if "medical_staff";
    "read" if "administrative_staff";
    "read" if global "admin";
    "create_user" if "administrative_staff";
    "create_user" if global "admin";

    ## EMR permissions
    "schedule_appointment" if "administrative_staff";
}

# Our `global` roles will be identified as belonging to the `_` organization.
global {
  # In our applications, `global` admins are meant to have unfettered access to
  # resources.
  roles = ["admin"];
  permissions = ["create_org"];

  "create_org" if "admin";
}

# When accessing an application, you do so as a `User`.
#
# Though an advanced feature of Polar, our applications also treat `User`s as
# resources. This is necessary to articulate differing sets of permissions
# between `User`s.
#
# `User` permissions are meant to rely on ReBAC (the relationship between users
# and organizations), which is why we only need to use Polar's shorthand rules.
actor User {
    # Actions which users may try to take on other users.
    permissions = ["read", "delete"];

    # The base of ReBAC. With this, rather than specifying roles for this
    # resource, we will rely on roles provided through the relationship.
    relations = {
        parent: Organization
    };

    # ReBAC, which we can identify because all of the permissions are based on
    # the user's relationship to `relations` member.
    "read" if "read" on "parent";
    "delete" if "administrative_staff" on "parent";
}

resource Appointment {
  permissions = ["read", "cancel", "complete"];
  relations = {
      scheduled: Organization,
      medical_staff: User,
      patient: User,
  };

  "read" if "read" on "scheduled";
  "read" if "patient";

  "complete" if "medical_staff" and appointment_status(resource, "scheduled");

  "cancel" if "administrative_staff" on "scheduled"
    and appointment_status(resource, "scheduled");
}

resource Record {
  permissions = ["read", "read.internal"];
  relations = {
    from: Appointment,
  };

  "read" if "read" on "from";
}

# This record is a record of this patient's.
patient_record(patient: User, record: Record) if
  appointment matches Appointment
  and has_relation(record, "from", appointment)
  and has_relation(appointment, "patient", patient);

# This appointment was not canceled and this user is the appointment's medical staff.
medical_staff_for_appointment(medical_staff: User, appointment: Appointment) if
  has_relation(appointment, "medical_staff", medical_staff)
  and (
    appointment_status(appointment, "scheduled")
    or appointment_status(appointment, "completed")
  );

# User's can "read.internal" on a record if the record belongs to a patient for
# which they are or have been scheduled to be the medical staff of.
has_permission(user: User, "read.internal", record: Record) if
  # The record belongs to this patient.
  patient matches User
  and patient_record(patient, record)
  # There exists an appointment for which:
  # - The user is the medical staff
  # - The patient is the patient
  and appointment matches Appointment
  and has_relation(appointment, "patient", patient)
  and medical_staff_for_appointment(user, appointment);

# For more details about how this interacts with other components of the system,
# see:
# - env_template_db_init.sql for the application's SQL schema
# - oso_local_auth_*.yml for services' local authorization config
