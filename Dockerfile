FROM node:22-bookworm-slim

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json at this stage to leverage the build cache
COPY package*.json ./

# Install dependencies
RUN npm ci

# Install chromium and its dependencies, but only for headless mode
RUN npx -y playwright install --with-deps --only-shell chromium

# Copy the rest of the app
COPY . .

# Build the app
RUN npm run build

# Run in headless and only with chromium (other browsers need more dependencies not included in this image)
ENTRYPOINT ["node", "cli.js", "--headless", "--browser", "chromium"]