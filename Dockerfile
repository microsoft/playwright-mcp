ARG USERNAME=node
ARG PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# ------------------------------
# Base
# ------------------------------
FROM node:22-bookworm-slim AS base

# Set the working directory
WORKDIR /app

RUN --mount=type=cache,target=/root/.npm,sharing=locked,id=npm-cache \
    --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
  # Install `node_modules` including dev dependencies to run playwright commands with npx
  npm ci && \
  # Install system dependencies for playwright
  npx playwright install-deps chromium-headless-shell && \
  # Overwrite with only production `node_modules` required for runtime
  npm ci --omit=dev

# ------------------------------
# Builder
# ------------------------------
FROM base AS builder

ARG PLAYWRIGHT_BROWSERS_PATH
ENV PLAYWRIGHT_BROWSERS_PATH=${PLAYWRIGHT_BROWSERS_PATH}

RUN --mount=type=cache,target=/root/.npm,sharing=locked,id=npm-cache \
    --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
  # Install `node_modules` including dev dependencies to run playwright commands with npx
  npm ci && \
  # Install browser binaries
  npx playwright install --only-shell chromium

# Copy the rest of the app
COPY . .

# Build the app
RUN npm run build

# ------------------------------
# Runtime
# ------------------------------
FROM base

ARG USERNAME
ARG PLAYWRIGHT_BROWSERS_PATH
ENV PLAYWRIGHT_BROWSERS_PATH=${PLAYWRIGHT_BROWSERS_PATH}
ENV NODE_ENV=production

# Set the correct ownership for the runtime user on production `node_modules`
RUN chown -R ${USERNAME}:${USERNAME} node_modules

USER ${USERNAME}

# Copy the executable `cli.js` and the `package.json` used for version retrieval
COPY --chown=${USERNAME}:${USERNAME} cli.js package.json ./
# Copy the built code
COPY --from=builder --chown=${USERNAME}:${USERNAME} /app/lib /app/lib
# Copy the browser binaries
COPY --from=builder --chown=${USERNAME}:${USERNAME} ${PLAYWRIGHT_BROWSERS_PATH} ${PLAYWRIGHT_BROWSERS_PATH}

# Run in headless and only with chromium (other browsers need more dependencies not included in this image)
ENTRYPOINT ["node", "cli.js", "--headless", "--browser", "chromium"]
