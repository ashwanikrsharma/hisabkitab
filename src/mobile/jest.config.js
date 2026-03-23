module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@supabase/.*|zustand|@tanstack/.*)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@hisabkitab/services$': '<rootDir>/../services/src/index.ts',
    '^@hisabkitab/shared$': '<rootDir>/../shared/src/index.ts',
  },
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
};
