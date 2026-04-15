import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', '*.ngrok-free.app', '*.ngrok-free.dev'],
  outputFileTracingIncludes: {
    '/[handle]/opengraph-image': [
      './public/fonts/SpaceGrotesk/SpaceGrotesk-Bold.woff2',
      './public/fonts/SpaceMono/SpaceMono-Bold.woff2',
      './public/cta-wide-logo.png',
    ],
  },
};

export default nextConfig;
