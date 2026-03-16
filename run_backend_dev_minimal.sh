#!/bin/bash
#
# Run minimal development setup for the backend, without nginx. Access to API is direct via WSGI server on port 8000.
# If you use this script, start the frontend using the `run_frontend_dev_minimal.sh` script in the frontend repo.

BACKEND_CONFIG_PATH="./dev_tools/local_minimal/backend_settings/.env.dev-minimal"

if [ ! -f "$BACKEND_CONFIG_PATH" ]; then
  echo "ERROR: Backend minimal template config file not found at '$BACKEND_CONFIG_PATH', are you in the root of the repository?"
  exit 1
fi

cp $BACKEND_CONFIG_PATH backend/.env || { echo "ERROR: Failed to copy backend config file, please check the paths and permissions."; exit 1; }

cd backend/ && uv run uvicorn o_timeusediary_backend.api:app --reload --host 127.0.0.1 --port 8000
