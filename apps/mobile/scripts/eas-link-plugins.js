#!/usr/bin/env node
/**
 * EAS Build helper: symlink hoisted Expo plugins into apps/mobile/node_modules.
 *
 * npm workspaces hoists most packages to the monorepo root node_modules/.
 * Expo's plugin resolver requires plugins to be resolvable from the project
 * directory (apps/mobile/). This script creates symlinks so they're found.
 *
 * Called from eas-build-pre-install AFTER `npm install` at the monorepo root.
 */
const fs = require('fs');
const path = require('path');

const mobileRoot = path.resolve(__dirname, '..');
const monorepoRoot = path.resolve(mobileRoot, '..', '..');
const localNm = path.join(mobileRoot, 'node_modules');
const rootNm = path.join(monorepoRoot, 'node_modules');

// Expo plugins referenced in app.config.ts
const plugins = [
  'expo-router',
  'expo-secure-store',
  'expo-notifications',
  'expo-build-properties',
];

// Additional packages that Expo internals need to resolve from the project dir
const internals = [
  '@expo/env',
  '@expo/fingerprint',
];

const allPackages = [...plugins, ...internals];

fs.mkdirSync(localNm, { recursive: true });

for (const pkg of allPackages) {
  const localPath = path.join(localNm, pkg);
  const rootPath = path.join(rootNm, pkg);

  // Create parent dir for scoped packages
  if (pkg.startsWith('@')) {
    const scope = pkg.split('/')[0];
    fs.mkdirSync(path.join(localNm, scope), { recursive: true });
  }

  if (fs.existsSync(localPath)) {
    console.log(`[eas-link] ${pkg}: already exists locally, skipping`);
    continue;
  }

  if (!fs.existsSync(rootPath)) {
    console.log(`[eas-link] ${pkg}: not found at root, skipping`);
    continue;
  }

  fs.symlinkSync(rootPath, localPath, 'dir');
  console.log(`[eas-link] ${pkg}: symlinked ${rootPath} -> ${localPath}`);
}

console.log('[eas-link] Done.');
