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
      ...(photosHost ? [{ protocol: 'https' as const, hostname: photosHost }] : []),
    ],
  },
};

export default nextConfig;
