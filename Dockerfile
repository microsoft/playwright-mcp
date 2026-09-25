ARG PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
# Registry prefix for the base image, e.g. 'playwright.azurecr.io/cached/' in the publish pipeline.
ARG ACR_CACHE_PREFIX
# Debian archive host used by apt, e.g. 'debian-archive.trafficmanager.net' in the publish pipeline.
ARG DEBIAN_MIRROR_HOST=deb.debian.org

# ------------------------------
# Base
# ------------------------------
# Base stage: Contains only the minimal dependencies required for runtime
# (node_modules and Playwright system dependencies)
FROM ${ACR_CACHE_PREFIX}node:lts-slim AS base

ARG PLAYWRIGHT_BROWSERS_PATH
ENV PLAYWRIGHT_BROWSERS_PATH=${PLAYWRIGHT_BROWSERS_PATH}
ARG DEBIAN_MIRROR_HOST

# Set the working directory
WORKDIR /app

RUN --mount=type=cache,target=/root/.npm,sharing=locked,id=npm-cache \
    --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=secret,id=npmrc,target=/root/.npmrc,required=false \
  npm ci --omit=dev && \
  # Install system dependencies for playwright. apt is pointed at the mirror only for
  # the duration of the install, so the published image keeps the default archive host.
  sed -i "s|deb.debian.org|${DEBIAN_MIRROR_HOST}|g" /etc/apt/sources.list.d/debian.sources && \
  npx -y playwright-core install-deps chromium && \
  # tini reaps orphaned browser processes that would otherwise become zombies under node as PID 1.
  apt-get install -y --no-install-recommends tini && \
  rm -rf /var/lib/apt/lists/* && \
  sed -i "s|${DEBIAN_MIRROR_HOST}|deb.debian.org|g" /etc/apt/sources.list.d/debian.sources

# ------------------------------
# Builder
# ------------------------------
FROM base AS builder

RUN --mount=type=cache,target=/root/.npm,sharing=locked,id=npm-cache \
    --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=secret,id=npmrc,target=/root/.npmrc,required=false \
  npm ci

# Copy the rest of the app
COPY *.json *.js *.ts .

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

# Set the correct ownership for the runtime user on production `node_modules`
RUN chown -R ${USERNAME}:${USERNAME} node_modules

USER ${USERNAME}

COPY --from=browser --chown=${USERNAME}:${USERNAME} ${PLAYWRIGHT_BROWSERS_PATH} ${PLAYWRIGHT_BROWSERS_PATH}
COPY --chown=${USERNAME}:${USERNAME} cli.js package.json ./

# Current working directory must be writable as MCP may need to create default output dir in it.
WORKDIR /home/${USERNAME}

# Run in headless and only with chromium (other browsers need more dependencies not included in this image)
ENTRYPOINT ["/usr/bin/tini", "-s", "--", "node", "/app/cli.js", "--headless", "--browser", "chromium", "--no-sandbox"]
