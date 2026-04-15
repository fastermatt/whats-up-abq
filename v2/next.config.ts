import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Tell Turbopack to use v2/ as root to avoid picking up the repo root package-lock.json
  turbopack: {
    root: __dirname,
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
    ],
  },
}

export default nextConfig
