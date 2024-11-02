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

# Medical staff can view the internal portion of a record if:
# - There exists an appointment with the patient for which they are the
#   medical_staff
# - The record was created from an appointment in the same organization as their
#   appointment with the patient
has_permission(user: User, "read.internal", record: Record) if
  org matches Organization
  and has_role(user, "medical_staff", org)
  # Introduce the patient for which this record was created
  and other_appointment matches Appointment
  and has_relation(record, "from", other_appointment)
  and patient matches User
  and has_relation(other_appointment, "patient", patient)
  and has_relation(other_appointment, "scheduled", org)
  # If this user is the medical_staff for a scheduled or complete appointment
  # with this patient
  and user_appointment matches Appointment
  and has_relation(user_appointment, "patient", patient)
  and has_relation(user_appointment, "scheduled", org)
  and has_relation(user_appointment, "medical_staff", user)
  and (
    appointment_status(user_appointment, "scheduled")
    or appointment_status(user_appointment, "completed")
  );

# For more details about how this interacts with other components of the system,
# see:
# - env_template_db_init.sql for the application's SQL schema
# - oso_local_auth_*.yml for services' local authorization config
