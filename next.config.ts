import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Item photos can point anywhere, but in the seeded catalog some point at
  // Holvi's CDN because that is where the current shop keeps them.
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'cdn.holvi.com' }],
  },
};

export default nextConfig;
