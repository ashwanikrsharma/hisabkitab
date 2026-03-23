/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable response compression
  compress: true,
  // Transpile monorepo packages
  transpilePackages: ['@hisabkitab/services', '@hisabkitab/shared'],
  experimental: {
    // Enable server actions
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
    // Tree-shake and optimize imports for large packages
    optimizePackageImports: ['lucide-react', '@supabase/supabase-js', 'zod'],
  },
  // Optimized image formats
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // Security and caching headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
