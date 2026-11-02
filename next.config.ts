import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The Prompt API is a window API. Nothing model-related may be bundled for the server.
  // See BUILD_PROMPT.md §9.1.
  experimental: { typedRoutes: true },
  // The dev badge sits on top of the footer attribution; we need that readable.
  devIndicators: false,
};

export default nextConfig;
