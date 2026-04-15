import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Silence Turbopack multi-lockfile warning when repo root has another package-lock.json
  experimental: {
    turbo: {
      root: __dirname,
    },
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
