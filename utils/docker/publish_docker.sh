#!/usr/bin/env bash

set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

MCR_IMAGE_NAME="playwright/mcp"

RELEASE_CHANNEL="$1"
if [[ "${RELEASE_CHANNEL}" != "stable" && "${RELEASE_CHANNEL}" != "canary" ]]; then
  echo "ERROR: unknown release channel - '${RELEASE_CHANNEL}'"
  echo "Must be either 'stable' or 'canary'"
  exit 1
fi

MCP_VERSION=$(node -p "require('../../package.json').version")
if [[ "${RELEASE_CHANNEL}" == "stable" && ! "${MCP_VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "ERROR: cannot publish stable docker with @playwright/mcp version '${MCP_VERSION}'"
  exit 1
fi

TAGS=()
if [[ "${RELEASE_CHANNEL}" == "stable" ]]; then
  TAGS+=("v${MCP_VERSION}" "latest")
else
  TAGS+=("v${MCP_VERSION}-canary-$(date -u +'%Y%m%d%H%M%S')")
  echo "== CANARY build: publishing to ${TAGS[0]} tag =="
fi

tag_and_push() {
  local source="$1"
  local target="$2"
  echo "-- tagging: $target"
  docker tag $source $target
  docker push $target
  attach_eol_manifest $target
}

attach_eol_manifest() {
  local image="$1"
  local today=$(date -u +'%Y-%m-%d')
  install_oras_if_needed
  # oras is re-using Docker credentials, so we don't need to login.
  # Following the advice in https://portal.microsofticm.com/imp/v3/incidents/incident/476783820/summary
  ./oras/oras attach --artifact-type application/vnd.microsoft.artifact.lifecycle --annotation "vnd.microsoft.artifact.lifecycle.end-of-life.date=$today" $image
}

install_oras_if_needed() {
  if [[ -x oras/oras ]]; then
    return
  fi
  local version="1.1.0"
  local arch="amd64"
  if [[ "$(uname -m)" == "aarch64" || "$(uname -m)" == "arm64" ]]; then
    arch="arm64"
  fi
  curl -sLO "https://github.com/oras-project/oras/releases/download/v${version}/oras_${version}_linux_${arch}.tar.gz"
  mkdir -p oras
  tar -zxf oras_${version}_linux_${arch}.tar.gz -C oras
  rm oras_${version}_linux_${arch}.tar.gz
}

publish_docker_images_with_arch_suffix() {
  local ARCH="$1"
  if [[ "$ARCH" != "amd64" && "$ARCH" != "arm64" ]]; then
    echo "ERROR: unknown arch - $ARCH. Must be either 'amd64' or 'arm64'"
    exit 1
  fi
  # Prune docker images to avoid platform conflicts
  docker system prune -fa
  ./build.sh "--${ARCH}" playwright-mcp:localbuild

  for ((i = 0; i < ${#TAGS[@]}; i++)) do
    local TAG="${TAGS[$i]}"
    tag_and_push playwright-mcp:localbuild "playwright.azurecr.io/public/${MCR_IMAGE_NAME}:${TAG}-${ARCH}"
  done
}

publish_docker_manifest () {
  for ((i = 0; i < ${#TAGS[@]}; i++)) do
    local TAG="${TAGS[$i]}"
    local BASE_IMAGE_TAG="playwright.azurecr.io/public/${MCR_IMAGE_NAME}:${TAG}"
    local IMAGE_NAMES=""
    if [[ "$1" == "arm64" || "$1" == "amd64" ]]; then
        IMAGE_NAMES="${IMAGE_NAMES} ${BASE_IMAGE_TAG}-$1"
    fi
    if [[ "$2" == "arm64" || "$2" == "amd64" ]]; then
        IMAGE_NAMES="${IMAGE_NAMES} ${BASE_IMAGE_TAG}-$2"
    fi
    docker manifest create "${BASE_IMAGE_TAG}" $IMAGE_NAMES
    docker manifest push "${BASE_IMAGE_TAG}"
    attach_eol_manifest "${BASE_IMAGE_TAG}"
  done
}

# arm64 first: its QEMU-emulated build must run while the host is fresh. Running
# it after the native amd64 build has churned the host triggers a qemu segfault
# in aarch64 ldconfig during libc-bin setup. amd64 is a native build and is
# unaffected by preceding work, so it goes second.
publish_docker_images_with_arch_suffix arm64
publish_docker_images_with_arch_suffix amd64
publish_docker_manifest amd64 arm64
