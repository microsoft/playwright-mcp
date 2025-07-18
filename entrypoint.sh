#!/bin/sh

# Mark as running in Docker
export PLAYWRIGHT_DOCKER=1

# Run in headless and only with chromium (other browsers need more dependencies not included in this image)
BASE_ARGS="--headless --browser chromium --no-sandbox"

if [ "$REMOTE_HTTP" = "true" ] || [ "$REMOTE_HTTP" = "1" ]; then
    exec node cli.js $BASE_ARGS --host 0.0.0.0 --port 8931
else
    exec node cli.js $BASE_ARGS
fi