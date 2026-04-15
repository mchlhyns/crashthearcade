import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', '*.ngrok-free.app', '*.ngrok-free.dev'],
  outputFileTracingIncludes: {
    '/*/opengraph-image': [
      './public/fonts/SpaceGrotesk/SpaceGrotesk-Bold.ttf',
      './public/fonts/SpaceMono/SpaceMono-Bold.ttf',
      './public/cta-wide-logo.png',
    ],
  },
};

export default nextConfig;
