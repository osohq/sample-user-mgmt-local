-- substitutions occur in db_init_generate.sh
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};

\connect ${DB_NAME};
