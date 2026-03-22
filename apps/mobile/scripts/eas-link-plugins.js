#!/usr/bin/env node
/**
 * EAS Build helper: ensure critical Expo packages are resolvable from
 * apps/mobile/node_modules.
 *
 * With install-strategy=nested, most packages end up in the right place.
 * But some transitive deps (like @expo/env) get nested deep inside other
 * packages. This script finds them and symlinks them to the top level
 * so Expo's internals can resolve them.
 *
 * Called as postinstall from apps/mobile/package.json.
 */
const fs = require('fs');
const path = require('path');

const mobileRoot = path.resolve(__dirname, '..');
const monorepoRoot = path.resolve(mobileRoot, '..', '..');
const localNm = path.join(mobileRoot, 'node_modules');
const rootNm = path.join(monorepoRoot, 'node_modules');

// Packages that must be resolvable from apps/mobile/
const required = [
  'expo-router',
  'expo-secure-store',
  'expo-notifications',
  'expo-build-properties',
  '@expo/env',
  '@expo/fingerprint',
];

fs.mkdirSync(localNm, { recursive: true });

/**
 * Recursively search for a package in node_modules directories.
 * Returns the first found path, or null.
 */
function findPackage(pkg, searchDirs) {
  for (const dir of searchDirs) {
    const candidate = path.join(dir, pkg);
    if (fs.existsSync(candidate)) return candidate;
  }

  // Deep search: look inside local node_modules subdirs
  if (fs.existsSync(localNm)) {
    try {
      const entries = fs.readdirSync(localNm, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
        if (entry.name.startsWith('.')) continue;
        const nested = path.join(localNm, entry.name, 'node_modules', pkg);
        if (fs.existsSync(nested)) return nested;
        // Check scoped packages one level deeper
        if (entry.name.startsWith('@')) {
          try {
            const scopeEntries = fs.readdirSync(path.join(localNm, entry.name), { withFileTypes: true });
            for (const scopeEntry of scopeEntries) {
              const scopeNested = path.join(localNm, entry.name, scopeEntry.name, 'node_modules', pkg);
              if (fs.existsSync(scopeNested)) return scopeNested;
            }
          } catch {}
        }
      }
    } catch {}
  }

  return null;
}

for (const pkg of required) {
  const localPath = path.join(localNm, pkg);

  if (fs.existsSync(localPath)) {
    console.log(`[eas-link] ${pkg}: already exists locally`);
    continue;
  }

  // Create parent dir for scoped packages
  if (pkg.startsWith('@')) {
    const scope = pkg.split('/')[0];
    fs.mkdirSync(path.join(localNm, scope), { recursive: true });
  }

  // Search in root node_modules first, then deep search locally
  const found = findPackage(pkg, [rootNm]);
  if (found) {
    fs.symlinkSync(found, localPath, 'dir');
    console.log(`[eas-link] ${pkg}: symlinked from ${found}`);
    continue;
  }

  // Deep search in local node_modules
  const deepFound = findPackage(pkg, []);
  if (deepFound) {
    fs.symlinkSync(deepFound, localPath, 'dir');
    console.log(`[eas-link] ${pkg}: symlinked from nested ${deepFound}`);
    continue;
  }

  console.log(`[eas-link] ${pkg}: NOT FOUND anywhere`);
}

console.log('[eas-link] Done.');
