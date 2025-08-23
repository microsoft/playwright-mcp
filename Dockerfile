ARG PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# ------------------------------
# Base
# ------------------------------
# Base stage: Contains only the minimal dependencies required for runtime
# (node_modules and Playwright system dependencies)
FROM oven/bun:1.2.20-slim AS base

ARG PLAYWRIGHT_BROWSERS_PATH
ENV PLAYWRIGHT_BROWSERS_PATH=${PLAYWRIGHT_BROWSERS_PATH}

# Set the working directory
WORKDIR /app

# Install Node.js (required for Playwright)
RUN apt-get update && apt-get install -y curl && \
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
  apt-get install -y nodejs && \
  apt-get clean && rm -rf /var/lib/apt/lists/*

# Install production dependencies with bun
RUN --mount=type=cache,target=/root/.bun/install/cache,sharing=locked,id=bun-cache \
  --mount=type=bind,source=package.json,target=package.json \
  --mount=type=bind,source=bun.lock,target=bun.lock \
  bun install --frozen-lockfile --production && \
  # Install system dependencies for playwright (using npx as Playwright requires Node.js)
  npx -y playwright-core install-deps chromium

# ------------------------------
# Builder
# ------------------------------
FROM base AS builder

# Install all dependencies (including dev dependencies) with bun
RUN --mount=type=cache,target=/root/.bun/install/cache,sharing=locked,id=bun-cache \
  --mount=type=bind,source=package.json,target=package.json \
  --mount=type=bind,source=bun.lock,target=bun.lock \
  bun install --frozen-lockfile

# Copy the rest of the app
COPY --chmod=644 *.json *.js *.ts .
COPY --chmod=644 src src/

# Build the app
RUN bun run build

# ------------------------------
# Browser
# ------------------------------
# Cache optimization:
# - Browser is downloaded only when node_modules or Playwright system dependencies change
# - Cache is reused when only source code changes
FROM base AS browser

RUN npx -y playwright-core install --no-shell chromium

# ------------------------------
# Runtime
# ------------------------------
FROM base

ARG PLAYWRIGHT_BROWSERS_PATH
ARG USERNAME=node
ENV NODE_ENV=production

# Set read-only permissions for node_modules to prevent unnecessary write access
# Use 444 for files (read-only for all), 555 for directories (read+execute for all)
RUN chmod -R 444 node_modules && \
  find node_modules -type d -exec chmod 555 {} \;

USER ${USERNAME}

COPY --from=browser --chown=${USERNAME}:${USERNAME} --chmod=755 ${PLAYWRIGHT_BROWSERS_PATH} ${PLAYWRIGHT_BROWSERS_PATH}
COPY --chown=${USERNAME}:${USERNAME} --chmod=444 cli.js package.json ./
COPY --from=builder --chown=${USERNAME}:${USERNAME} --chmod=444 /app/lib /app/lib

# Run in headless and only with chromium (other browsers need more dependencies not included in this image)
ENTRYPOINT ["bun", "cli.js", "--headless", "--browser", "chromium", "--no-sandbox"]
