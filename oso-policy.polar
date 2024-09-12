

# Our applications are meant to demonstrate multi-tenancy, and we will separate
# tenants into separate, distinct `Organization`s.
#
# `Organization` permissions are meant to rely on standard RBAC, which is why we
# only need to use Polar's shorthand rules.
resource Organization {
    # Roles which users may have within an organization.
    roles = ["admin", "member"];

    # Actions which users may try to take on an organization.
    permissions = ["read", "create_user", "create"];

    # Role implication.
    "admin" if global "admin";
    "member" if "admin";

    # RBAC
    "create" if global "admin";
    "read" if "member";
    "create_user" if "admin";
}

# Our `global` roles will be identified as belonging to the `_` organization.
global {
  # In our applications, `global` admins are meant to have unfettered access to
  # resources.
  roles = ["admin"];
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
    permissions = ["read", "edit_role", "delete"];

    # The base of ReBAC. With this, rather than specifying roles for this
    # resource, we will rely on roles provided through the relationship.
    relations = {
        parent: Organization
    };

    # ReBAC, which we can identify because all of the permissions are based on
    # the user's relationship to `relations` member.
    "read" if "member" on "parent";
    "edit_role" if "admin" on "parent";
    "delete" if "admin" on "parent";
}

# For more details about how this interacts with other components of the system,
# see:
# - db_init_template.sql for the application's SQL schema
# - oso-local-auth.yaml for how we correlate the policy to the SQL schema
