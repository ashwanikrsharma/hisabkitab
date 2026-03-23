import { ExpoConfig, ConfigContext } from 'expo/config';

// Environment variables are injected at build time.
// On mobile, access these via Constants.expoConfig.extra — NEVER hardcode.
// See: https://docs.expo.dev/guides/environment-variables/
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'HisabKitab',
  slug: 'hisabkitab',
  owner: 'ashwkumars-organization',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'hisabkitab',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#1a1a2e',
  },
  updates: {
    fallbackToCacheTimeout: 0,
  },
  assetBundlePatterns: ['assets/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.hisabkitab.app',
    infoPlist: {
      NSCameraUsageDescription: 'Used to attach receipt photos to expenses.',
      NSPhotoLibraryUsageDescription: 'Used to attach receipt photos to expenses.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#1a1a2e',
    },
    package: 'com.hisabkitab.app',
    permissions: [
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
      'RECEIVE_BOOT_COMPLETED',
      'VIBRATE',
    ],
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-sqlite',
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#E8651A',
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          // Only include arm64 (real devices) + x86_64 (emulators).
          // Cuts native lib size in half by dropping armeabi-v7a and x86.
          includedAbis: ['arm64-v8a', 'x86_64'],
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    // All secrets injected from environment — never hardcode values here.
    // Access in app: Constants.expoConfig?.extra?.supabaseUrl
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'https://hisabkitab-five.vercel.app',
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? '2f77da0a-22f5-4991-90e5-1cb6be7b1103',
    },
  },
});
