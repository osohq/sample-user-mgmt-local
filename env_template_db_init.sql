-- Each service should have its own database to enforce logical isolation
-- between services (which alleviates the headache of spinning up multiple
-- physical services).

--
-- USER SERVICE
--
CREATE DATABASE users;

-- substitutions occur via env_template_init.sh in Dockerfile.db; if not using
-- the orchestrated DB, you can skip this section.
GRANT ALL PRIVILEGES ON DATABASE users TO ${DB_USER};

\connect users;

-- the remainder of these commands create the data model + data for the
-- application

CREATE TABLE organizations (name TEXT PRIMARY KEY);

-- Note that this is synchronized with oso-policy.polar
CREATE TYPE organization_role AS ENUM ('admin', 'medical_staff', 'administrative_staff', 'patient');

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

--
-- EMR SERVICE
--
CREATE DATABASE emr;

-- substitutions occur via env_template_init.sh in Dockerfile.db; if not using
-- the orchestrated DB, you can skip this section.
GRANT ALL PRIVILEGES ON DATABASE emr TO ${DB_USER};

\connect emr;

-- Note that this is synchronized with oso-policy.polar
CREATE TYPE appointment_status AS ENUM ('scheduled', 'canceled', 'completed');

CREATE TABLE appointments (
	id SERIAL PRIMARY KEY,
	org TEXT,
	medical_staff TEXT,
	patient TEXT,
	scheduled_at TIMESTAMP,
	status appointment_status
);
CREATE INDEX appt_idx_medical_staff ON
	appointments(medical_staff, patient, scheduled_at);

CREATE TABLE records (
	id SERIAL PRIMARY KEY,
	appointment_id SERIAL REFERENCES appointments (id),
	internal_text TEXT,
	public_text TEXT
)

-- For more details about how this interacts with other components of the system,
-- see:
-- - oso_policy.polar for this application's Polar policy, for use in Oso Cloud
-- - oso_local_auth_*.yml for how services correlate the policy to the SQL schema
