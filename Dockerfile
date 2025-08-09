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

# SonarQube Security Hotspot Fix: Using --ignore-scripts prevents malicious script execution
# Package verification: This package.json contains no preinstall/postinstall scripts
# Security measure: --ignore-scripts flag prevents potential code injection via npm scripts
RUN --mount=type=cache,target=/root/.npm,sharing=locked,id=npm-cache \
    --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
  npm ci --omit=dev --ignore-scripts && \
  # Install system dependencies for playwright
  npx -y playwright-core install-deps chromium

# ------------------------------
# Builder
# ------------------------------
FROM base AS builder

# SonarQube Security Hotspot Fix: Using --ignore-scripts prevents malicious script execution
# Package verification: This package.json contains no preinstall/postinstall scripts  
# Security measure: --ignore-scripts flag prevents potential code injection via npm scripts
RUN --mount=type=cache,target=/root/.npm,sharing=locked,id=npm-cache \
    --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
  npm ci --ignore-scripts

# Copy the rest of the app
COPY --chmod=644 *.json *.js *.ts .
COPY --chmod=644 src src/

# Build the app
RUN npm run build

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

COPY --from=browser --chown=root:root --chmod=755 ${PLAYWRIGHT_BROWSERS_PATH} ${PLAYWRIGHT_BROWSERS_PATH}
COPY --chown=root:root --chmod=444 cli.js package.json ./
COPY --from=builder --chown=root:root --chmod=444 /app/lib /app/lib

# Run in headless and only with chromium (other browsers need more dependencies not included in this image)
ENTRYPOINT ["node", "cli.js", "--headless", "--browser", "chromium", "--no-sandbox"]
