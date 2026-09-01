import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Tell Turbopack to use v2/ as root to avoid picking up the repo root package-lock.json
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        // Allow cross-origin fetch of static public assets (images, icons, etc.)
        source: '/:path*.(png|jpg|jpeg|svg|webp|gif|ico)',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, HEAD' },
        ],
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.abqunplugged.com',
      },
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
      },
      {
        protocol: 'https',
        hostname: 'bsmvfutebmbkjvlrhiyq.supabase.co',
      },
    ],
  },
}

export default nextConfig
