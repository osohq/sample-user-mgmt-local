#!/bin/bash

# Load the .env file
set -a
source .env
set +a

# Replace placeholders in the SQL template file
envsubst < db_init_template.sql > tmp.sql

cat tmp.sql seed_db.sql > init.sql

rm tmp.sql
