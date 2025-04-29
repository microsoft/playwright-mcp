# ------------------------------
# Base
# ------------------------------
FROM node:22-bookworm-slim AS base

# Set the working directory
WORKDIR /app

RUN --mount=type=cache,target=/root/.npm,sharing=locked,id=npm-cache \
    --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
  npm ci --omit=dev

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
COPY src src/

# Build the app
RUN npm run build

# ------------------------------
# Runtime
# ------------------------------
FROM base

ARG USERNAME=node
ENV NODE_ENV=production

# Set the correct ownership for the runtime user on production `node_modules`
RUN chown -R ${USERNAME}:${USERNAME} node_modules

RUN npx -y playwright-core install-deps chromium

USER ${USERNAME}

COPY --chown=${USERNAME}:${USERNAME} cli.js package.json ./
COPY --from=builder --chown=${USERNAME}:${USERNAME} /app/lib /app/lib
RUN npx -y playwright-core install --no-shell chromium

# Run in headless and only with chromium (other browsers need more dependencies not included in this image)
ENTRYPOINT ["node", "cli.js", "--headless", "--browser", "chromium"]
