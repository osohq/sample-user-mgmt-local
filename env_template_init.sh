#!/bin/bash

# Load the .env file
set -a
source .env
set +a

# Find all files in the current directory that start with "template_"
for file in env_template_*; do
  # Extract the file name without the "template_" prefix
  trimmed_file="${file#env_template_}"

  # Run the command with envsubst
  envsubst < "$file" > "$trimmed_file"
done
