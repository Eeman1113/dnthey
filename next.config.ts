import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The Prompt API is a window API. Nothing model-related may be bundled for the server.
  // See BUILD_PROMPT.md §9.1.
  experimental: { typedRoutes: true },

  images: {
    // Serve AVIF to browsers that accept it, WebP to the rest. Measured on this
    // library: AVIF is 37-50% smaller than the equivalent WebP.
    formats: ['image/avif', 'image/webp'],
    // Portraits render at 56px (card) and 128px (party list); biome plates are
    // full-bleed. Narrowing the candidate widths stops Next generating a dozen
    // sizes nobody requests.
    imageSizes: [56, 96, 128, 256, 384],
    deviceSizes: [640, 828, 1080, 1280, 1920],
    minimumCacheTTL: 31536000,
  },
  // The dev badge sits on top of the footer attribution; we need that readable.
  devIndicators: false,
};

export default nextConfig;
