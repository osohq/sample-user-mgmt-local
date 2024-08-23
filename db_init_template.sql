-- substitutions occur in db_init_generate.sh
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};

\connect ${DB_NAME};

CREATE TABLE organizations (name TEXT PRIMARY KEY);

CREATE TYPE organization_role AS ENUM ('member', 'admin');

CREATE TABLE users (
	username
		TEXT PRIMARY KEY,
	org
		TEXT REFERENCES organizations (name),
	"role"
		organization_role
);

INSERT INTO organizations (name) VALUES ('_');
INSERT INTO users (username, org, "role") VALUES ('root', '_', 'admin');
