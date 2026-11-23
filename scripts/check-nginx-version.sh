#!/usr/bin/env sh
# Fails unless the image's nginx is at or above the fixed release for
# NGINX2Root (HTTP/2 bugs fixed in 1.30.7 stable / 1.31.9 mainline).
set -eu

IMAGE="${1:?usage: check-nginx-version.sh <image>}"

VERSION=$(docker run --rm --entrypoint nginx "$IMAGE" -v 2>&1 | sed -n 's|^nginx version: nginx/||p')
if [ -z "$VERSION" ]; then
  echo "could not read nginx version from $IMAGE" >&2
  exit 1
fi

MINOR=$(echo "$VERSION" | cut -d. -f2)
case "$MINOR" in
  30) MIN=1.30.7 ;;
  31) MIN=1.31.9 ;;
  *) MIN=1.30.7 ;;
esac

LOWEST=$(printf '%s\n%s\n' "$MIN" "$VERSION" | sort -V | head -n1)
if [ "$LOWEST" != "$MIN" ]; then
  echo "nginx $VERSION in $IMAGE is vulnerable to NGINX2Root; need >= $MIN" >&2
  exit 1
fi

echo "nginx $VERSION in $IMAGE is >= $MIN"
