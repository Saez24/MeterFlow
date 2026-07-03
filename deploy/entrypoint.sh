#!/bin/bash
set -euo pipefail

# CSP nonce substitution relies on nginx's sub_filter module. Fail fast if it is
# missing, otherwise the __CSP_NONCE__ placeholder would leak and break the app.
if ! nginx -V 2>&1 | grep -q http_sub_module; then
    echo "ERROR: nginx built without ngx_http_sub_module — CSP nonce won't work." >&2
    exit 1
fi

echo "→ Applying database migrations..."
if ! python manage.py migrate --noinput; then
    echo "ERROR: Django migration failed. Container will not start." >&2
    exit 1
fi

echo "→ Starting nginx + gunicorn via supervisord..."
exec supervisord -c /etc/supervisor/conf.d/meterflow.conf
