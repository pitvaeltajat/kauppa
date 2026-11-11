import type { NextConfig } from 'next';

// Uploaded item images live in the S3 bucket behind
// NEXT_PUBLIC_KAUPPA_ITEM_PHOTOS_URL; allow its host for next/image.
const photosUrl = process.env.NEXT_PUBLIC_KAUPPA_ITEM_PHOTOS_URL;
const photosHost = photosUrl ? new URL(photosUrl).hostname : undefined;

const nextConfig: NextConfig = {
  // Item photos can point anywhere, but in the seeded catalog some point at
  // Holvi's CDN because that is where the current shop keeps them.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.holvi.com' },
      { protocol: 'https', hostname: '**.kuvat.fi' },
      ...(photosHost ? [{ protocol: 'https' as const, hostname: photosHost }] : []),
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ];
  },
};

export default nextConfig;
