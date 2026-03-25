# gunicorn_conf.dev.py -- Development configuration for Gunicorn with Uvicorn workers
#
# This configuration mirrors the production setup for local development testing.
# To run the server with this configuration, use the command:
#
#     gunicorn -c deployment/gunicorn_conf.dev.py o_timeusediary_backend.api:app
#
# For auto-reload during development (requires watchdog), add the --reload flag:
#
#     gunicorn --reload -c deployment/gunicorn_conf.dev.py o_timeusediary_backend.api:app
#
# To install watchdog: uv pip install watchdog
#

import multiprocessing

workers = max(1, min(multiprocessing.cpu_count() * 2 - 1, 8))  # Scale with CPU count, max 8 workers
worker_class = "uvicorn.workers.UvicornWorker"

# Socket binding
bind = "127.0.0.1:8000"

# Timeouts
timeout = 120
keepalive = 5

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"

# Process naming
proc_name = "tud_backend_dev"
