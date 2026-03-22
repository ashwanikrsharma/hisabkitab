#!/bin/bash
# Symlink hoisted Expo plugins into apps/mobile/node_modules so the
# Expo config plugin resolver can find them on EAS Build.
# This is needed because npm workspaces hoists packages to the root.

MOBILE_NM="$(dirname "$0")/../node_modules"
ROOT_NM="$(dirname "$0")/../../../node_modules"

mkdir -p "$MOBILE_NM"

for pkg in expo-router expo-secure-store expo-notifications expo-build-properties; do
  if [ ! -d "$MOBILE_NM/$pkg" ] && [ -d "$ROOT_NM/$pkg" ]; then
    ln -s "../../../node_modules/$pkg" "$MOBILE_NM/$pkg"
    echo "Symlinked $pkg"
  fi
done
