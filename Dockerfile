# ------------------------------
# Base
# ------------------------------
# Base stage: Contains only the minimal dependencies required for runtime
# (node_modules and Playwright system dependencies)
FROM node:22-bookworm-slim AS base

# Set the working directory
WORKDIR /app

RUN --mount=type=cache,target=/root/.npm,sharing=locked,id=npm-cache \
    --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
  npm ci --omit=dev && \
  # Install system dependencies for playwright
  npx -y playwright-core install-deps chromium

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
# - Bump BRAVE_BROWSER_CACHEBUST roughly every two weeks to pick up a new Brave release.
# - Cache is reused when only source code changes
FROM base AS browser

ARG BRAVE_BROWSER_CACHEBUST=2026-09-09

RUN echo "Installing Brave (browser cache key: ${BRAVE_BROWSER_CACHEBUST})" && \
    apt-get -qq update && \
    apt-get -qy install curl && \
    curl -fsSLo /usr/share/keyrings/brave-browser-archive-keyring.gpg \
      https://brave-browser-apt-release.s3.brave.com/brave-browser-archive-keyring.gpg && \
    curl -fsSLo /etc/apt/sources.list.d/brave-browser-release.sources \
      https://brave-browser-apt-release.s3.brave.com/brave-browser.sources && \
    apt-get -qq update && \
    apt-get -qy install --no-install-recommends \
      brave-browser \
      fonts-dejavu-core \
      fonts-noto-color-emoji && \
    rm -rf /var/lib/apt/lists/* /var/cache/apt/*

# ------------------------------
# Runtime
# ------------------------------
FROM browser

ARG USERNAME=node
ENV NODE_ENV=production

# Set the correct ownership for the runtime user on production `node_modules`
RUN chown -R ${USERNAME}:${USERNAME} node_modules

USER ${USERNAME}

COPY --chown=${USERNAME}:${USERNAME} cli.js package.json ./

# Current working directory must be writable as MCP may need to create default output dir in it.
WORKDIR /home/${USERNAME}

# Brave uses Playwright's Chromium engine with the system-installed Brave executable.
ENTRYPOINT ["node", "/app/cli.js", "--headless", "--browser", "chromium", "--executable-path", "/usr/bin/brave-browser", "--no-sandbox"]
