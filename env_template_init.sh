#!/bin/bash

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Error: .env file not found"
    exit 1
fi

# Load environment variables from .env file
set -a  # automatically export all variables
source .env
set +a  # stop automatically exporting

# Find all files in the current directory that start with "env_template_"
for file in env_template_*; do
    # Check if the file ends with .sh, and skip if it does
    if [[ "$file" == *.sh ]]; then
        echo "Skipping shell script: $file"
        continue
    fi

    output_file="${file#env_template_}"
    
    # Check if output file already exists
    if [ -f "$output_file" ]; then
        echo "Warning: Output file '$output_file' already exists, skipping..."
        continue
    fi
    
    # Create file with variables replaced
    if envsubst < "$file" > "$output_file"; then
        echo "Created: $output_file"
    else
        echo "Error processing $file"
        rm -f "$output_file"  # Clean up partial file on error
    fi
done
