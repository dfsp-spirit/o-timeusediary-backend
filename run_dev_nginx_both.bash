#!/bin/bash
#
# Run this script to start nginx with the development configuration that serves both the frontend and backend.
# Also runs the FastAPI backend on port 8000. Make sure to have nginx installed.
#
# To use this script, simply run it from the terminal. It will start nginx in the background and then run the FastAPI backend in the foreground.


## Start nginx with the development configuration in background

## save current directory to return to it later
CURRENT_DIR=$(pwd)

echo "yo yo"

NGINX_CONF_DIR="./dev_tools/local_nginx/webserver_config/"

if [ ! -d "$NGINX_CONF_DIR" ]; then
    echo -e "ERROR: nginx configuration directory not found at '$NGINX_CONF_DIR'. Current working directory: $(pwd)"
    exit 1
fi

cd "$NGINX_CONF_DIR" || { echo -e "ERROR: Failed to change directory to '$NGINX_CONF_DIR'"; exit 1; }


GIT_FRONTEND_REPO_PATH=$CURRENT_DIR/frontend
GIT_BACKEND_REPO_PATH=$CURRENT_DIR/backend

# Create the nginx configuration file from the template, replacing 'USERHOME' with the actual home directory
NGINX_CONF_FILE="./dev.nginx.conf"
./replace_home.sh dev.nginx.conf.template "$NGINX_CONF_FILE" "$GIT_FRONTEND_REPO_PATH" "$GIT_BACKEND_REPO_PATH" || { echo -e "ERROR: Failed to create nginx configuration file from template"; exit 1; }

sed -i '1i# THIS FILE IS AUTO-GENERATED FROM THE TEMPLATE ON EACH START. DO NOT EDIT!' "$NGINX_CONF_FILE"

if [ ! -f "$NGINX_CONF_FILE" ]; then
    echo -e "ERROR: nginx configuration file not found at $NGINX_CONF_FILE in current working directory $(pwd)"
    exit 1
fi

FULL_NGINX_CONF_PATH="$(pwd)/$NGINX_CONF_FILE" # nginx requires an absolute path to the configuration file, or changing its config dir.

# Copy frontend config file
cp "$CURRENT_DIR/dev_tools/local_nginx/frontend_settings/tud_settings.dev-nginx.js" "$CURRENT_DIR/frontend/src/settings/tud_settings.js" || { echo -e "ERROR: Failed to copy frontend config file"; exit 1; }

# Copy backend config .env file
cp "$CURRENT_DIR/dev_tools/local_nginx/backend_settings/.env.dev-nginx" "$CURRENT_DIR/backend/.env" || { echo -e "ERROR: Failed to copy backend config file"; exit 1; }

cleanup() {
    echo -e "\n Shutting down nginx service..."

    kill -QUIT $(cat $HOME/nginx-dev.pid) && echo "Cleanup complete. Goodbye!" || echo "WARNING: Failed to stop nginx. You may need to stop it manually with 'kill -QUIT \$(cat \$HOME/nginx-dev.pid)'"
}

# Set up trap for Ctrl+C
trap cleanup SIGINT SIGTERM

nginx -c "$FULL_NGINX_CONF_PATH"

if [ $? -eq 0 ]; then
    echo -e "Started nginx successfully, frontend available at http://localhost:3000/report/"
    echo -e "Backend API available at http://localhost:3000/tud_backend/api"
    echo -e "INFO nginx is running in the background with configuration from $FULL_NGINX_CONF_PATH"
    echo -e "INFO Press CTRL+C to stop the FastAPI backend, and then run 'kill -QUIT \$(cat \$HOME/nginx-dev.pid)' to stop nginx"
else
    echo -e "ERROR: Failed to start nginx"
    exit 1
fi


## Start the FastAPI backend in the foreground
# note that --reload requires the python package 'watchdog' to be installed, which is included in the dev dependencies.

cd "$CURRENT_DIR/backend/" && uv run gunicorn --reload -c ../deployment/gunicorn_conf.dev.py o_timeusediary_backend.api:app || { echo -e " Failed to start FastAPI backend"; exit 1; }


