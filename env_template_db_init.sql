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
CREATE TYPE organization_role AS ENUM ('admin', 'sales', 'analyst', 'deal_desk');

-- Do not allow duplicate usernames. Each user belongs to a single organization.
CREATE TABLE users (
	username
		TEXT PRIMARY KEY,
	org
		TEXT REFERENCES organizations (name),
	"role"
		organization_role,
    manager
        TEXT REFERENCES users (username)
);

-- Our special `global` organization
INSERT INTO organizations (name) VALUES ('_root');
-- A default, bootstrap user
INSERT INTO users (username, org, "role") VALUES ('root', '_root', 'admin');

-- substitutions occur via env_template_init.sh in Dockerfile.db; if not using
-- the orchestrated DB, you can skip this section.

CREATE DATABASE crm;

GRANT ALL PRIVILEGES ON DATABASE crm TO ${DB_USER};

\connect crm;

CREATE TABLE territories (
    name TEXT PRIMARY KEY
);

CREATE TABLE territory_hierarchy (
    ancestor_id TEXT NOT NULL REFERENCES territories(name),
    descendant_id TEXT NOT NULL REFERENCES territories(name),
    PRIMARY KEY (ancestor_id, descendant_id)
);

CREATE OR REPLACE FUNCTION get_ancestors(node_id TEXT)
RETURNS TEXT[] AS $$
WITH RECURSIVE ancestry AS (
    SELECT ancestor_id, descendant_id, ARRAY[ancestor_id] as path, 1 as depth
    FROM territory_hierarchy
    WHERE descendant_id = node_id
    AND ancestor_id != descendant_id
    
    UNION ALL
    
    SELECT t.ancestor_id, t.descendant_id, t.ancestor_id || a.path, a.depth + 1
    FROM territory_hierarchy t
    JOIN ancestry a ON t.descendant_id = a.ancestor_id
    WHERE t.ancestor_id != t.descendant_id
)
SELECT COALESCE(
    (SELECT path 
     FROM ancestry 
     ORDER BY depth DESC 
     LIMIT 1),
    ARRAY[]::TEXT[]
);
$$ LANGUAGE SQL;

INSERT INTO territories (name) VALUES
    ('USA'),
    ('Northeast'),
    ('Northwest'),
    ('Southeast'),
    ('Southwest'),
    ('NY'),
    ('PA'),
    ('FL'),
    ('WA'),
    ('AZ'),
    ('NYC'),
    ('Staten Island'),
    ('Philadelphia'),
    ('Gainesville'),
    ('Tampa'),
    ('Seattle'),
    ('Tacoma'),
    ('Phoenix'),
    ('Tucson');

INSERT INTO territory_hierarchy (ancestor_id, descendant_id) VALUES
('USA', 'Northeast'),
('Northeast', 'NY'),
('NY', 'NYC'),
('NY', 'Staten Island'),
('Northeast', 'PA'),
('PA', 'Philadelphia'),
('USA', 'Northwest'),
('Northwest', 'WA'),
('WA', 'Seattle'),
('WA', 'Tacoma'),
('USA', 'Southeast'),
('Southeast', 'FL'),
('FL', 'Gainesville'),
('FL', 'Tampa'),
('USA', 'Southwest'),
('Southwest', 'AZ'),
('AZ', 'Phoenix'),
('AZ', 'Tucson');

CREATE TABLE sales_territory_manager(
    org TEXT NOT NULL,
	territory TEXT NOT NULL REFERENCES territories(name),
	username TEXT NOT NULL,
	PRIMARY KEY (org, territory)
);

CREATE TYPE opportunity_stage AS ENUM ('research', 'qualifying', 'poc', 'negotiating', 'closed-won', 'closed-lost');

CREATE TABLE opportunities (
	name TEXT NOT NULL,
	territory TEXT NOT NULL REFERENCES territories(name),
    amount DECIMAL(10, 2) DEFAULT 0.0,
	assignee TEXT,
    organization TEXT NOT NULL,
    stage opportunity_stage,
    PRIMARY KEY (name, organization)
);

-- For more details about how this interacts with other components of the system,
-- see:
-- - oso_policy.polar for this application's Polar policy, for use in Oso Cloud
-- - oso_local_auth_*.yml for how services correlate the policy to the SQL schema
