#!/bin/sh
# Render entrypoint for Playwright MCP.
#
# Starts Playwright MCP with only the flags Render needs — no capability,
# origin, or timeout limits are applied on top of upstream's defaults.
#
# Playwright MCP ships no authentication in HTTP mode, so anyone who can reach
# the URL can run code in this container. Restricting access is the operator's
# job — see the README "Security" section.
#
# The port comes from $PORT (Render sets it) and, by default, the server's host
# check is scoped to this service's own hostname via $RENDER_EXTERNAL_HOSTNAME
# (Render sets it automatically), falling back to "*" for local runs. Set
# PLAYWRIGHT_MCP_ALLOWED_HOSTS to override — e.g. to add a custom domain
# (comma-separated) or to pass "*" to disable the host check.
set -eu

PORT="${PORT:-10000}"
ALLOWED_HOSTS="${PLAYWRIGHT_MCP_ALLOWED_HOSTS:-${RENDER_EXTERNAL_HOSTNAME:-*}}"

# Upstream's own startup banner prints "http://localhost:$PORT/mcp", which is
# misleading on Render. Print the real public URL first so anyone copy-pasting
# from the logs gets the right endpoint.
echo "[startup] Connect MCP clients to: https://${RENDER_EXTERNAL_HOSTNAME:-localhost:$PORT}/mcp"

exec node /app/cli.js \
  --headless --browser chromium --no-sandbox \
  --host 0.0.0.0 --port "$PORT" \
  --allowed-hosts "$ALLOWED_HOSTS"
