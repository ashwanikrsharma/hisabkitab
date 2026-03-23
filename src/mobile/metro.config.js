const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo so changes in packages/ are picked up
config.watchFolders = [monorepoRoot];

// Resolve modules from both the app's node_modules and the root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Block test-only packages from being bundled into the app.
// npm hoists devDependencies to the monorepo root node_modules,
// causing Metro to resolve them at runtime which crashes on Node-only APIs.
// Patterns use .* prefix to match full absolute paths that Metro resolves against.
config.resolver.blockList = [
  /.*\/node_modules\/@testing-library\/.*/,
  /.*\/node_modules\/jest-.*/,
  /.*\/node_modules\/ts-jest\/.*/,
  // Exclude co-located test files from being bundled (Expo Router treats them as routes)
  /.*\.test\.(ts|tsx|js|jsx)$/,
  /.*\.spec\.(ts|tsx|js|jsx)$/,
];

module.exports = config;
