ARG PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
# Registry prefix for the base image, e.g. 'playwright.azurecr.io/cached/' in the publish pipeline.
ARG ACR_CACHE_PREFIX
# Prefix of the Ubuntu archive hosts used by apt, e.g. 'azure.' in the publish pipeline.
ARG UBUNTU_MIRROR_PREFIX

# ------------------------------
# Base
# ------------------------------
# Base stage: Contains only the minimal dependencies required for runtime
# (Node.js, node_modules and Playwright system dependencies)
FROM ${ACR_CACHE_PREFIX}ubuntu:noble AS base

ARG PLAYWRIGHT_BROWSERS_PATH
ENV PLAYWRIGHT_BROWSERS_PATH=${PLAYWRIGHT_BROWSERS_PATH}
ARG UBUNTU_MIRROR_PREFIX
ARG NODE_VERSION=26
ARG DEBIAN_FRONTEND=noninteractive

# Set the working directory
WORKDIR /app

RUN --mount=type=cache,target=/root/.npm,sharing=locked,id=npm-cache \
    --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=secret,id=npmrc,target=/root/.npmrc,required=false \
  # apt is pointed at the mirror only for the duration of the install, so the published
  # image keeps the default archive hosts.
  sed -i "s|http://archive.ubuntu.com|http://${UBUNTU_MIRROR_PREFIX}archive.ubuntu.com|g; s|http://ports.ubuntu.com|http://${UBUNTU_MIRROR_PREFIX}ports.ubuntu.com|g" /etc/apt/sources.list.d/ubuntu.sources && \
  # Pick up security fixes that the base image does not have yet.
  apt-get update && \
  apt-get upgrade -y && \
  # Install Node.js from NodeSource.
  apt-get install -y --no-install-recommends curl gpg ca-certificates && \
  mkdir -p /etc/apt/keyrings && \
  curl -sL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_VERSION}.x nodistro main" > /etc/apt/sources.list.d/nodesource.list && \
  apt-get update && \
  apt-get install -y --no-install-recommends nodejs && \
  # Node.js links against libatomic (since Node.js 25).
  apt-get install -y --no-install-recommends libatomic1 && \
  # tini reaps orphaned browser processes that would otherwise become zombies under node as PID 1.
  apt-get install -y --no-install-recommends tini && \
  npm ci --omit=dev && \
  # Install system dependencies for playwright.
  npx -y playwright-core install-deps chromium && \
  # curl and gpg were only needed to set up the Node.js repository.
  apt-get purge -y --auto-remove curl gpg && \
  rm -rf /var/lib/apt/lists/* && \
  sed -i "s|http://${UBUNTU_MIRROR_PREFIX}archive.ubuntu.com|http://archive.ubuntu.com|g; s|http://${UBUNTU_MIRROR_PREFIX}ports.ubuntu.com|http://ports.ubuntu.com|g" /etc/apt/sources.list.d/ubuntu.sources && \
  # Same runtime user as in the node images: 'node' with uid 1000, which is 'ubuntu' in the base image.
  usermod -l node -d /home/node -m ubuntu && \
  groupmod -n node ubuntu

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
