# Our applications are meant to demonstrate multi-tenancy, and we will separate
# tenants into separate, distinct `Organization`s.
#
# `Organization` permissions are meant to rely on standard RBAC, which is why we
# only need to use Polar's shorthand rules.
resource Organization {
    # Roles which users may have within an organization.
    roles = ["admin", "member", "sales", "analyst", "deal_desk"];

    # Actions which users may try to take on an organization.
    permissions = ["read", "create_user", "create_opportunity"];

    "admin" if global "admin";
    "member" if "admin";
    "member" if "sales";
    "member" if "analyst";
    "member" if "deal_desk";

    # RBAC
    "read" if "member";
    "create_user" if "admin";

    ## CRM permissions
    "create_opportunity" if "sales";
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
    permissions = ["read", "edit_role", "assign_territory"];

    # The base of ReBAC. With this, rather than specifying roles for this
    # resource, we will rely on roles provided through the relationship.
    relations = {
        parent: Organization,
        manager: User,
    };

    # ReBAC, which we can identify because all of the permissions are based on
    # the user's relationship to `relations` member.
    "read" if "read" on "parent";
    "edit_role" if "admin" on "parent";
    
    "assign_territory" if "sales" on "parent" and is_sales_user(resource);
    "assign_territory" if "admin" on "parent" and is_sales_user(resource);
    "assign_territory" if "manager" and is_sales_user(resource);
}

is_sales_user(user: User) if
  org matches Organization
  and has_role(user, "sales", org);

# For more details about how this interacts with other components of the system,
# see:
# - env_template_db_init.sql for the application's SQL schema
# - oso_local_auth_*.yml for services' local authorization config

# Rename Territory––only one assign
resource Territory {
  permissions = ["manage_responsibility", "create_opportunity"];
  roles = ["responsible"];
  relations = {
    ancestor: Territory
  };

  "responsible" if "responsible" on "ancestor";

  "manage_responsibility" if "responsible" on "ancestor";

  "create_opportunity" if "responsible";
}

has_permission(user: User, "manage_responsibility", Territory{"USA"}) if
  org matches Organization
  and has_role(user, "admin", org);

has_permission(user: User, "manage_responsibility", Territory{"USA"}) if
  has_role(user, "admin");

has_permission(user: User, "manage_responsibility", Territory{"USA"}) if
  has_role(user, "responsible", Territory{"USA"});

resource Opportunity {
  roles = ["potential_assignee"];
  permissions = ["read", "assign", "change_details", "view_amount"];
  relations = {
    assignee: User,
    territory: Territory,
    org: Organization,
  };

  "read" if "read" on "org";

  "assign" if "responsible" on "territory";
  "potential_assignee" if "responsible" on "territory";
  "potential_assignee" if in_stage(resource, "negotiating") and "deal_desk" on "org";

  "view_amount" if "assignee";
  "view_amount" if "manager" on "assignee";
  "view_amount" if "responsible" on "territory";
  "view_amount" if "analyst" on "org";

  "change_details" if "assignee";
  "change_details" if "manager" on "assignee";
}
