FROM golang:1.21-bookworm AS builder

WORKDIR /app

# Copy go.mod and go.sum files
COPY go.mod go.sum* ./

# Download dependencies
RUN go mod download

# Copy the source code
COPY . .

# Install playwright
RUN go install github.com/playwright-community/playwright-go/cmd/playwright@latest && \
    playwright install chromium

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -v -o /playwright-mcp ./cmd/server

FROM mcr.microsoft.com/playwright:v1.41.1-jammy

WORKDIR /app

# Copy built binary
COPY --from=builder /playwright-mcp /app/
COPY --from=builder /root/.cache/ms-playwright /root/.cache/ms-playwright

# Set the entry point
ENTRYPOINT ["/app/playwright-mcp"]

# Default arguments
CMD ["--port", "3000"]
