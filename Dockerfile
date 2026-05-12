ARG PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# ------------------------------
# Base
# ------------------------------
# Base stage: Contains only the minimal dependencies required for runtime
# (node_modules and Playwright system dependencies)
FROM node:22-bookworm-slim AS base

ARG PLAYWRIGHT_BROWSERS_PATH
ENV PLAYWRIGHT_BROWSERS_PATH=${PLAYWRIGHT_BROWSERS_PATH}

# Set the working directory
WORKDIR /app

RUN --mount=type=cache,target=/root/.npm,sharing=locked,id=npm-cache \
    --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
  npm ci --omit=dev && \
  # Install system dependencies for all Playwright browsers (chromium, firefox, webkit)
  npx -y playwright-core install-deps chromium firefox webkit

# ------------------------------
# Builder
# ------------------------------
FROM base AS builder

RUN --mount=type=cache,target=/root/.npm,sharing=locked,id=npm-cache \
    --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
  npm ci

# Copy the rest of the app
COPY *.json *.js *.ts .

# ------------------------------
# Browser
# ------------------------------
# Cache optimization:
# - Browsers are downloaded only when node_modules or Playwright system dependencies change
# - Cache is reused when only source code changes
FROM base AS browser

RUN npx -y playwright-core install --no-shell chromium firefox webkit

# ------------------------------
# Runtime
# ------------------------------
FROM base

ARG PLAYWRIGHT_BROWSERS_PATH
ARG USERNAME=node
ENV NODE_ENV=production

# Set the correct ownership for the runtime user on production `node_modules`
RUN chown -R ${USERNAME}:${USERNAME} node_modules

USER ${USERNAME}

COPY --from=browser --chown=${USERNAME}:${USERNAME} ${PLAYWRIGHT_BROWSERS_PATH} ${PLAYWRIGHT_BROWSERS_PATH}
COPY --chown=${USERNAME}:${USERNAME} cli.js package.json ./

# Current working directory must be writable as MCP may need to create default output dir in it.
WORKDIR /home/${USERNAME}

# Run in headless mode with --no-sandbox, defaulting to chromium
# Users can override the browser by passing --browser <browser> as container args
ENTRYPOINT ["node", "/app/cli.js", "--headless", "--no-sandbox"]
CMD ["--browser", "chromium"]
