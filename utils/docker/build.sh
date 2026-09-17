#!/usr/bin/env bash
set -e
set +x

if [[ ($1 == '--help') || ($1 == '-h') || ($1 == '') || ($2 == '') ]]; then
  echo "usage: $(basename $0) {--arm64,--amd64} playwright-mcp:localbuild"
  echo
  echo "Build the Playwright MCP docker image and tag it as 'playwright-mcp:localbuild'."
  echo "Once the image is built, you can run it with"
  echo ""
  echo "  docker run -i --rm --init playwright-mcp:localbuild"
  echo ""
  echo "Optional environment variables:"
  echo "  ACR_CACHE_PREFIX  registry prefix for the base image, e.g. 'playwright.azurecr.io/cached/'"
  echo "  NPMRC_SECRET      path to an .npmrc to use for 'npm ci' inside the image (BuildKit secret)"
  echo ""
  exit 0
fi

trap "cd $(pwd -P)" EXIT
# The Dockerfile lives at the repository root, which is also the build context.
cd "$(dirname "$0")/../.."

PLATFORM=""
if [[ "$1" == "--arm64" ]]; then
  PLATFORM="linux/arm64";
elif [[ "$1" == "--amd64" ]]; then
  PLATFORM="linux/amd64"
else
  echo "ERROR: unknown platform specifier - $1. Only --arm64 or --amd64 is supported"
  exit 1
fi

# Let npm inside the image use the same registry as the host. Passed as a BuildKit
# secret, so the (possibly authenticated) .npmrc never lands in an image layer.
SECRET_ARGS=()
if [[ -n "${NPMRC_SECRET:-}" ]]; then
  SECRET_ARGS+=(--secret "id=npmrc,src=${NPMRC_SECRET}")
fi

# Keep each arch image a plain single-platform manifest without the unknown/unknown platform entry.
export BUILDX_NO_DEFAULT_ATTESTATIONS=1

# The arm64 image is cross-built under QEMU user-mode emulation, where ldconfig
# segfaults intermittently at startup (tonistiigi/binfmt#298, every binfmt build
# since QEMU 8.1.4). apt's libc-bin trigger runs ldconfig, so a crash fails the
# whole `docker build`. Retry: BuildKit keeps the layers that already succeeded, so
# a retry re-runs only the failed RUN step.
MAX_ATTEMPTS=1
if [[ "${PLATFORM}" == "linux/arm64" ]]; then
  MAX_ATTEMPTS=3
fi

for ((attempt = 1; attempt <= MAX_ATTEMPTS; attempt++)); do
  if docker build --platform "${PLATFORM}" \
      --build-arg ACR_CACHE_PREFIX="${ACR_CACHE_PREFIX:-}" \
      "${SECRET_ARGS[@]}" \
      -t "$2" -f Dockerfile .; then
    exit 0
  fi
  if (( attempt < MAX_ATTEMPTS )); then
    echo "docker build failed (attempt ${attempt}/${MAX_ATTEMPTS}), retrying..." >&2
  fi
done
echo "ERROR: docker build failed after ${MAX_ATTEMPTS} attempt(s)" >&2
exit 1
