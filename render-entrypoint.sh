#!/bin/sh
# Render entrypoint for Playwright MCP.
#
# Playwright MCP ships no authentication in HTTP mode and exposes an
# RCE-equivalent tool, so this entrypoint does not publish it directly. It binds
# the server to loopback and puts render-auth-proxy.mjs on $PORT, which requires
# `Authorization: Bearer $MCP_TOKEN` on every request. render.yaml generates that
# token at deploy time; without it the container refuses to start. See the README
# "Security" section.
#
# Beyond that gate, no capability, origin, or timeout limits are applied on top
# of upstream's defaults.
#
# The port comes from $PORT (Render sets it) and, by default, the server's host
# check is scoped to this service's own hostname via $RENDER_EXTERNAL_HOSTNAME
# (Render sets it automatically), falling back to "*" for local runs. Set
# PLAYWRIGHT_MCP_ALLOWED_HOSTS to override — e.g. to add a custom domain
# (comma-separated) or to pass "*" to disable the host check.
set -eu

PORT="${PORT:-10000}"
# Loopback port the real MCP server listens on; only the proxy can reach it.
UPSTREAM_PORT="${UPSTREAM_PORT:-8931}"
ALLOWED_HOSTS="${PLAYWRIGHT_MCP_ALLOWED_HOSTS:-${RENDER_EXTERNAL_HOSTNAME:-*}}"
export PORT UPSTREAM_PORT

# Upstream's own startup banner prints "http://localhost:$PORT/mcp", which is
# misleading on Render. Print the real public URL first so anyone copy-pasting
# from the logs gets the right endpoint.
echo "[startup] Connect MCP clients to: https://${RENDER_EXTERNAL_HOSTNAME:-localhost:$PORT}/mcp"

# The proxy is PID 1 and supervises the server passed as its arguments.
exec node /usr/local/bin/render-auth-proxy.mjs \
  node /app/cli.js \
  --headless --browser chromium --no-sandbox \
  --host 127.0.0.1 --port "$UPSTREAM_PORT" \
  --allowed-hosts "$ALLOWED_HOSTS"
