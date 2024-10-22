-- Each service should have its own database to enforce logical isolation
-- between services (which alleviates the headache of spinning up multiple
-- physical services).
CREATE DATABASE users;

-- substitutions occur in env_template_init.sh; if not using the orchestrated
-- DB, you can skip this section.
GRANT ALL PRIVILEGES ON DATABASE users TO ${DB_USER};

\connect users;

-- the remainder of these commands create the data model + data for the
-- application

CREATE TABLE organizations (name TEXT PRIMARY KEY);

-- Note that this is synchronized with oso-policy.polar
CREATE TYPE organization_role AS ENUM ('member', 'admin');

-- Do not allow duplicate usernames. Each user belongs to a single organization.
CREATE TABLE users (
	username
		TEXT PRIMARY KEY,
	org
		TEXT REFERENCES organizations (name),
	"role"
		organization_role
);

-- Our special `global` organization
INSERT INTO organizations (name) VALUES ('_root');
-- A default, bootstrap user
INSERT INTO users (username, org, "role") VALUES ('root', '_root', 'admin');

-- For more details about how this interacts with other components of the system,
-- see:
-- - oso_policy.polar for this application's Polar policy, for use in Oso Cloud
-- - oso_local_auth_user_mgmt.yml for how we correlate the policy to the SQL schema
